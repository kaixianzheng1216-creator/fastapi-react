import json
import logging
from collections.abc import AsyncGenerator
from typing import Any
from urllib.parse import unquote_to_bytes
from uuid import UUID, uuid4

from assistant_stream import RunController, create_run  # type: ignore[import-untyped]
from assistant_stream.modules.langgraph import (  # type: ignore[import-untyped]
    append_langgraph_event,
    get_tool_call_subgraph_state,
)
from langchain_core.messages import BaseMessage, HumanMessage, ToolMessage
from langchain_core.runnables import RunnableConfig
from langfuse import propagate_attributes
from langfuse.langchain import CallbackHandler

from app.modules.agent.schemas import (
    AddMessageCommand,
    AgentChatRequest,
    AgentCommand,
    FileMessagePart,
    ImageMessagePart,
    TextMessagePart,
)

STREAM_ERROR_DETAIL = "Agent 流式响应失败"
TRACE_NAME = "agent-chat"
logger = logging.getLogger(__name__)


def stream_chat(
    *,
    agent: Any,
    user_id: UUID,
    chat_request: AgentChatRequest,
) -> AsyncGenerator[Any]:
    async def run(controller: RunController) -> None:
        await _run(controller, agent, user_id, chat_request)

    stream: AsyncGenerator[Any] = create_run(
        run,
        state=chat_request.state,
    )

    return stream


async def _run(
    controller: RunController,
    agent: Any,
    user_id: UUID,
    chat_request: AgentChatRequest,
) -> None:
    thread_id = f"{user_id}:{chat_request.thread_id}"
    events: Any | None = None

    try:
        if controller.state is None:
            controller.state = {"messages": []}
        elif "messages" not in controller.state:
            controller.state["messages"] = []

        if controller.is_cancelled:
            return

        agent_config, input_messages = await _prepare_run(
            controller,
            agent,
            thread_id,
            chat_request.commands,
        )

        agent_config["callbacks"] = [CallbackHandler()]

        with propagate_attributes(
            trace_name=TRACE_NAME,
            user_id=str(user_id),
            session_id=thread_id,
        ):
            events = agent.astream(
                {"messages": input_messages},
                config=agent_config,
                stream_mode=["messages", "updates"],
                subgraphs=True,
                version="v2",
            )

            async for chunk in events:
                if controller.is_cancelled:
                    break

                state = get_tool_call_subgraph_state(
                    controller,
                    namespace=chunk["ns"],
                    subgraph_node="tools",
                    tool_name="task",
                    artifact_field_name="subgraph_state",
                    default_state={"messages": []},
                )

                append_langgraph_event(
                    state,
                    chunk["ns"],
                    chunk["type"],
                    chunk["data"],
                )
    except Exception:
        logger.exception(STREAM_ERROR_DETAIL)
        controller.add_error(STREAM_ERROR_DETAIL)
    finally:
        if events is not None:
            close = getattr(events, "aclose", None)

            if close is not None:
                await close()


async def _prepare_run(
    controller: RunController,
    agent: Any,
    thread_id: str,
    commands: list[AgentCommand],
) -> tuple[RunnableConfig, list[BaseMessage]]:
    agent_config: RunnableConfig = {"configurable": {"thread_id": thread_id}}
    input_messages: list[BaseMessage] = []
    state_messages = controller.state["messages"]
    edit_command: AddMessageCommand | None = None

    for command in commands:
        if isinstance(command, AddMessageCommand) and command.source_id is not None:
            edit_command = command
            break

    if edit_command is not None:
        if len(commands) != 1:
            raise ValueError("编辑消息不能与其他命令同时发送")

        last_user_index: int | None = None

        for index in reversed(range(len(state_messages))):
            if state_messages[index]["type"] == "human":
                last_user_index = index
                break

        if (
            last_user_index is None
            or state_messages[last_user_index]["id"] != edit_command.source_id
        ):
            raise ValueError("只允许编辑最后一条用户消息")

        previous_message_id = (
            None if last_user_index == 0 else state_messages[last_user_index - 1]["id"]
        )

        restored_config: RunnableConfig | None = None

        async for snapshot in agent.aget_state_history(agent_config):
            snapshot_messages = snapshot.values.get("messages", [])

            if previous_message_id is None:
                if not snapshot_messages:
                    restored_config = snapshot.config
                    break
            elif snapshot_messages and snapshot_messages[-1].id == previous_message_id:
                restored_config = snapshot.config
                break

        if restored_config is None:
            raise ValueError("未找到编辑消息之前的检查点")

        agent_config = restored_config
        del state_messages[last_user_index:]

    for command in commands:
        message: BaseMessage

        if isinstance(command, AddMessageCommand):
            message = HumanMessage(
                content=_to_content(command),
                id=str(uuid4()),
            )
        else:
            content = command.model_content

            if content is None:
                content = command.result

            if not isinstance(content, str):
                content = json.dumps(content, ensure_ascii=False)

            artifact = command.artifact

            if artifact is None:
                artifact = command.result

            message = ToolMessage(
                content=content,
                tool_call_id=command.tool_call_id,
                name=command.tool_name,
                artifact=artifact,
                status="error" if command.is_error else "success",
                id=str(uuid4()),
            )

        state_messages.append(message.model_dump())
        input_messages.append(message)

    return agent_config, input_messages


def _to_content(
    command: AddMessageCommand,
) -> list[str | dict[str, Any]]:
    content: list[str | dict[str, Any]] = []

    for part in command.message.parts:
        if isinstance(part, TextMessagePart):
            content.append({"type": "text", "text": part.text})
        elif isinstance(part, ImageMessagePart):
            content.append(_to_resource("image", part.image))
        elif isinstance(part, FileMessagePart):
            file_content = _to_resource(
                "file",
                part.data,
                mime_type=part.mime_type,
            )

            if part.filename is not None:
                file_content["extras"] = {"filename": part.filename}

            content.append(file_content)

    return content


def _to_resource(
    part_type: str,
    resource: str,
    *,
    mime_type: str | None = None,
) -> dict[str, Any]:
    if not resource.startswith("data:"):
        content: dict[str, Any] = {"type": part_type, "url": resource}

        if mime_type is not None:
            content["mime_type"] = mime_type

        return content

    header, data = resource.split(",", maxsplit=1)

    declared_type = header.removeprefix("data:").split(";", maxsplit=1)[0]

    return {
        "type": part_type,
        "base64": unquote_to_bytes(data).decode("ascii"),
        "mime_type": mime_type or declared_type,
    }
