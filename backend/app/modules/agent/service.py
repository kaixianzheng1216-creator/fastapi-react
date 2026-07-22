import json
import logging
from collections.abc import AsyncGenerator
from typing import Any, cast
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
    AddToolResultCommand,
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

        config = await _get_config(
            agent,
            thread_id,
            chat_request.commands,
            controller.state["messages"],
        )

        inputs = _apply_commands(controller, chat_request.commands)

        config["callbacks"] = [CallbackHandler()]

        with propagate_attributes(
            trace_name=TRACE_NAME,
            user_id=str(user_id),
            session_id=thread_id,
        ):
            events = agent.astream(
                {"messages": inputs},
                config=config,
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


async def _get_config(
    agent: Any,
    thread_id: str,
    commands: list[AgentCommand],
    messages: list[dict[str, Any]],
) -> RunnableConfig:
    config: RunnableConfig = {"configurable": {"thread_id": thread_id}}
    edits: list[AddMessageCommand] = []

    for command in commands:
        if isinstance(command, AddMessageCommand) and command.source_id is not None:
            edits.append(command)

    if not edits:
        return config
    if len(edits) > 1:
        raise ValueError("每次请求只能编辑一条消息")

    source_index = _find_index(messages, edits[0].source_id)

    if source_index is None:
        raise ValueError("未找到源消息")

    previous_message_id: str | None = None

    if source_index > 0:
        previous_message_id = messages[source_index - 1]["id"]

    async for snapshot in agent.aget_state_history(config):
        snapshot_messages = snapshot.values.get("messages", [])

        if source_index == 0:
            if not snapshot_messages:
                return cast(RunnableConfig, dict(snapshot.config))
            continue

        if not snapshot_messages:
            continue

        if snapshot_messages[-1].id == previous_message_id:
            return cast(RunnableConfig, dict(snapshot.config))

    raise ValueError("未找到被编辑消息对应的检查点")


def _apply_commands(
    controller: RunController,
    commands: list[AgentCommand],
) -> list[BaseMessage]:
    inputs: list[BaseMessage] = []

    for command in commands:
        message: BaseMessage

        if isinstance(command, AddMessageCommand):
            messages = list(controller.state["messages"])

            retained = _truncate_messages(
                messages,
                command,
            )

            if retained != messages:
                controller.state["messages"] = retained

            message = HumanMessage(
                content=_to_content(command),
                id=str(uuid4()),
            )
        elif isinstance(command, AddToolResultCommand):
            model_content = (
                command.model_content
                if command.model_content is not None
                else command.result
            )

            if isinstance(model_content, str):
                content = model_content
            else:
                content = json.dumps(model_content, ensure_ascii=False)

            message = ToolMessage(
                content=content,
                tool_call_id=command.tool_call_id,
                name=command.tool_name,
                artifact=(
                    command.artifact
                    if command.artifact is not None
                    else command.result
                ),
                status="error" if command.is_error else "success",
                id=str(uuid4()),
            )

        controller.state["messages"].append(message.model_dump())

        inputs.append(message)

    return inputs


def _truncate_messages(
    messages: list[dict[str, Any]],
    command: AddMessageCommand,
) -> list[dict[str, Any]]:
    if command.source_id is None:
        return messages

    source_index = _find_index(messages, command.source_id)

    if command.source_id is not None and source_index is None:
        raise ValueError("未找到源消息")

    if command.parent_id is None:
        if source_index != 0:
            raise ValueError("没有父消息的消息必须是第一条消息")
    else:
        parent_index = _find_index(messages, command.parent_id)

        if parent_index is None:
            raise ValueError("未找到父消息")
        if parent_index >= source_index:
            raise ValueError("父消息必须位于源消息之前")

    return messages[:source_index]


def _find_index(
    messages: list[dict[str, Any]],
    message_id: str | None,
) -> int | None:
    if message_id is None:
        return None

    for index, message in enumerate(messages):
        if message["id"] == message_id:
            return index

    return None


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
