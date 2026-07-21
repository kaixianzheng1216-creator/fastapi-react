import json
import logging
from collections.abc import AsyncGenerator
from pathlib import Path
from typing import Any, cast
from urllib.parse import unquote_to_bytes
from uuid import UUID, uuid4

from assistant_stream import RunController, create_run  # type: ignore[import-untyped]
from assistant_stream.modules.langgraph import (  # type: ignore[import-untyped]
    append_langgraph_event,
)
from deepagents import create_deep_agent
from langchain_core.messages import BaseMessage, HumanMessage, ToolMessage
from langchain_core.runnables import RunnableConfig
from langchain_deepseek import ChatDeepSeek
from langfuse import propagate_attributes
from langfuse.langchain import CallbackHandler
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

from app.core.config import settings
from app.modules.agent.connections.exa import load_exa_tools
from app.modules.agent.exceptions import AgentNotConfiguredError
from app.modules.agent.schemas import (
    AddMessageCommand,
    AgentChatRequest,
    AgentCommand,
    FileMessagePart,
    ImageMessagePart,
    TextMessagePart,
)

SYSTEM_PROMPT = (
    (Path(__file__).parent / "prompts" / "system_prompt.md")
    .read_text(encoding="utf-8")
    .strip()
)
STREAM_ERROR_DETAIL = "Agent 流式响应失败"
TRACE_NAME = "agent-chat"
logger = logging.getLogger(__name__)


async def create_agent(checkpointer: AsyncPostgresSaver) -> Any:
    if not settings.DEEPSEEK_API_KEY:
        raise AgentNotConfiguredError

    tools = await load_exa_tools()

    model = ChatDeepSeek(
        model=settings.DEEPSEEK_MODEL,
        api_key=settings.DEEPSEEK_API_KEY,
        reasoning_effort="high",
        extra_body={"thinking": {"type": "enabled"}},
    )

    new_agent = create_deep_agent(
        model=model,
        tools=tools,
        system_prompt=SYSTEM_PROMPT,
        checkpointer=checkpointer,
    )

    return new_agent


def stream_chat(
    *,
    agent: Any,
    user_id: UUID,
    chat_request: AgentChatRequest,
) -> AsyncGenerator[Any]:
    async def run_agent(controller: RunController) -> None:
        await _run_chat(controller, agent, user_id, chat_request)

    chat_stream: AsyncGenerator[Any] = create_run(
        run_agent,
        state=chat_request.state,
    )

    return chat_stream


async def _run_chat(
    controller: RunController,
    agent: Any,
    user_id: UUID,
    chat_request: AgentChatRequest,
) -> None:
    thread_id = f"{user_id}:{chat_request.thread_id}"
    graph_stream: Any | None = None

    try:
        if controller.state is None:
            controller.state = {"messages": []}
        elif "messages" not in controller.state:
            controller.state["messages"] = []

        if controller.is_cancelled:
            return

        graph_config = await _create_graph_config(
            agent,
            thread_id,
            chat_request.commands,
        )
        input_messages = _apply_commands(controller, chat_request.commands)
        graph_config["callbacks"] = [CallbackHandler()]

        with propagate_attributes(
            trace_name=TRACE_NAME,
            user_id=str(user_id),
            session_id=thread_id,
        ):
            graph_stream = agent.astream(
                {"messages": input_messages},
                config=graph_config,
                stream_mode=["messages", "updates"],
                subgraphs=True,
            )
            async for namespace, stream_mode, event_data in graph_stream:
                if controller.is_cancelled:
                    break

                append_langgraph_event(
                    controller.state,
                    namespace,
                    stream_mode,
                    event_data,
                )
    except Exception:
        logger.exception(STREAM_ERROR_DETAIL)
        controller.add_error(STREAM_ERROR_DETAIL)
    finally:
        if graph_stream is not None:
            close_stream = getattr(graph_stream, "aclose", None)
            if close_stream is not None:
                await close_stream()


def _apply_commands(
    controller: RunController,
    commands: list[AgentCommand],
) -> list[BaseMessage]:
    messages: list[BaseMessage] = []

    for command in commands:
        message: BaseMessage
        if isinstance(command, AddMessageCommand):
            current_messages = list(controller.state["messages"])
            retained_messages = _truncate_messages_for_add_command(
                current_messages,
                command,
            )
            if retained_messages != current_messages:
                controller.state["messages"] = retained_messages

            message = HumanMessage(
                content=_convert_message_parts(command),
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
        messages.append(message)

    return messages


def _truncate_messages_for_add_command(
    messages: list[Any],
    command: AddMessageCommand,
) -> list[Any]:
    if command.parent_id is None and command.source_id is None:
        return messages

    source_index = _find_message_index(messages, command.source_id)
    if command.source_id is not None and source_index is None:
        raise ValueError("source message was not found")

    if command.parent_id is None:
        if source_index != 0:
            raise ValueError("a message without a parent must be the first message")
        return []

    parent_index = _find_message_index(messages, command.parent_id)
    if parent_index is None:
        raise ValueError("parent message was not found")

    if source_index is not None and source_index != parent_index + 1:
        raise ValueError("source message must immediately follow its parent")

    return messages[: parent_index + 1]


def _find_message_index(messages: list[Any], message_id: str | None) -> int | None:
    if message_id is None:
        return None

    for index, message in enumerate(messages):
        if isinstance(message, dict) and message.get("id") == message_id:
            return index

    return None


async def _create_graph_config(
    agent: Any,
    thread_id: str,
    commands: list[AgentCommand],
) -> RunnableConfig:
    base_config: RunnableConfig = {"configurable": {"thread_id": thread_id}}
    edit_commands = [
        command
        for command in commands
        if isinstance(command, AddMessageCommand) and command.source_id is not None
    ]

    if not edit_commands:
        return base_config
    if len(edit_commands) > 1:
        raise ValueError("only one message can be edited per request")

    parent_id = edit_commands[0].parent_id
    async for snapshot in agent.aget_state_history(base_config):
        checkpoint_messages = snapshot.values.get("messages", [])
        if _checkpoint_ends_with(checkpoint_messages, parent_id):
            return cast(RunnableConfig, dict(snapshot.config))

    raise ValueError("the checkpoint for the edited message was not found")


def _checkpoint_ends_with(messages: list[Any], parent_id: str | None) -> bool:
    if parent_id is None:
        return not messages
    if not messages:
        return False

    last_message = messages[-1]
    if isinstance(last_message, dict):
        return last_message.get("id") == parent_id

    return getattr(last_message, "id", None) == parent_id


def _convert_message_parts(
    command: AddMessageCommand,
) -> list[str | dict[Any, Any]]:
    content: list[str | dict[Any, Any]] = []

    for part in command.message.parts:
        if isinstance(part, TextMessagePart):
            content.append({"type": "text", "text": part.text})
        elif isinstance(part, ImageMessagePart):
            content.append(_convert_resource_part("image", part.image))
        elif isinstance(part, FileMessagePart):
            file_content = _convert_resource_part(
                "file",
                part.data,
                mime_type=part.mime_type,
            )
            if part.filename is not None:
                file_content["extras"] = {"filename": part.filename}
            content.append(file_content)

    return content


def _convert_resource_part(
    part_type: str,
    resource: str,
    *,
    mime_type: str | None = None,
) -> dict[str, Any]:
    if not resource.startswith("data:"):
        result: dict[str, Any] = {"type": part_type, "url": resource}
        if mime_type is not None:
            result["mime_type"] = mime_type
        return result

    header, payload = resource.split(",", maxsplit=1)
    declared_mime_type = header.removeprefix("data:").split(";", maxsplit=1)[0]
    return {
        "type": part_type,
        "base64": unquote_to_bytes(payload).decode("ascii"),
        "mime_type": mime_type or declared_mime_type,
    }
