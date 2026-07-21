import json
import logging
from collections.abc import AsyncGenerator
from typing import Any, cast
from urllib.parse import unquote_to_bytes
from uuid import UUID, uuid4

from assistant_stream import RunController, create_run  # type: ignore[import-untyped]
from assistant_stream.modules.langgraph import (  # type: ignore[import-untyped]
    append_langgraph_event,
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
    request: AgentChatRequest,
) -> AsyncGenerator[Any]:
    async def run(controller: RunController) -> None:
        await _run(controller, agent, user_id, request)

    stream: AsyncGenerator[Any] = create_run(
        run,
        state=request.state,
    )

    return stream


async def _run(
    controller: RunController,
    agent: Any,
    user_id: UUID,
    request: AgentChatRequest,
) -> None:
    # 准备状态
    thread_id = f"{user_id}:{request.thread_id}"
    events: Any | None = None

    try:
        if controller.state is None:
            controller.state = {"messages": []}
        elif "messages" not in controller.state:
            controller.state["messages"] = []

        if controller.is_cancelled:
            return

        # 准备输入
        config = await _get_config(
            agent,
            thread_id,
            request.commands,
        )

        inputs = _apply_commands(controller, request.commands)

        config["callbacks"] = [CallbackHandler()]

        # 运行 Agent
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

                append_langgraph_event(
                    controller.state,
                    chunk["ns"],
                    chunk["type"],
                    chunk["data"],
                )
    except Exception:
        logger.exception(STREAM_ERROR_DETAIL)

        controller.add_error(STREAM_ERROR_DETAIL)
    finally:
        # 收尾
        if events is not None:
            close = getattr(events, "aclose", None)

            if close is not None:
                await close()


async def _get_config(
    agent: Any,
    thread_id: str,
    commands: list[AgentCommand],
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

    parent_id = edits[0].parent_id

    async for snapshot in agent.aget_state_history(config):
        messages = snapshot.values.get("messages", [])

        if parent_id is None:
            if not messages:
                return cast(RunnableConfig, dict(snapshot.config))
            continue

        if not messages:
            continue

        last = messages[-1]
        last_id = last.get("id") if isinstance(last, dict) else getattr(last, "id", None)

        if last_id == parent_id:
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
        else:
            if isinstance(command.result, str):
                content = command.result
            else:
                content = json.dumps(command.result, ensure_ascii=False)

            message = ToolMessage(
                content=content,
                tool_call_id=command.tool_call_id,
                id=str(uuid4()),
            )

        controller.state["messages"].append(message.model_dump())
        inputs.append(message)

    return inputs


def _truncate_messages(
    messages: list[Any],
    command: AddMessageCommand,
) -> list[Any]:
    if command.parent_id is None and command.source_id is None:
        return messages

    source_index = _find_index(messages, command.source_id)
    if command.source_id is not None and source_index is None:
        raise ValueError("未找到源消息")

    if command.parent_id is None:
        if source_index != 0:
            raise ValueError("没有父消息的消息必须是第一条消息")
        return []

    parent_index = _find_index(messages, command.parent_id)
    if parent_index is None:
        raise ValueError("未找到父消息")

    if source_index is not None and source_index != parent_index + 1:
        raise ValueError("源消息必须紧跟在父消息之后")

    return messages[: parent_index + 1]


def _find_index(messages: list[Any], message_id: str | None) -> int | None:
    if message_id is None:
        return None

    for index, message in enumerate(messages):
        if isinstance(message, dict) and message.get("id") == message_id:
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
