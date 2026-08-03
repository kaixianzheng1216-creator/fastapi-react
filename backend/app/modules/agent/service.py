import json
import logging
from collections.abc import AsyncGenerator
from typing import Any
from uuid import UUID, uuid4

from assistant_stream import RunController, create_run  # type: ignore[import-untyped]
from assistant_stream.modules.langgraph import (  # type: ignore[import-untyped]
    append_langgraph_event,
    get_tool_call_subgraph_state,
)
from langchain_core.messages import (
    BaseMessage,
    HumanMessage,
    ToolMessage,
)
from langchain_core.runnables import RunnableConfig
from langfuse import propagate_attributes
from langfuse.langchain import CallbackHandler
from openai import APIError
from sqlmodel import Session

from app.common.exceptions import ApplicationError
from app.modules.agent.config import settings
from app.modules.agent.exceptions import (
    ImageInputNotSupportedError,
    ModelServiceUnavailableError,
    ThinkingNotSupportedError,
)
from app.modules.agent.model_capabilities import (
    ModelCapabilities,
    get_capabilities,
    list_capabilities,
)
from app.modules.agent.schemas import (
    AddMessageCommand,
    AgentChatRequest,
    AgentCommand,
    FileMessagePart,
    ImageMessagePart,
    TextMessagePart,
)
from app.modules.conversations import file_service as conversation_file_service
from app.modules.conversations.message_files import refresh_message_file_urls
from app.modules.files import service as file_service
from app.modules.files.exceptions import FileTypeNotAllowedError

STREAM_ERROR_DETAIL = "Agent 流式响应失败"
MODEL_REQUEST_ERROR_LOG = "模型请求失败"
TRACE_NAME = "agent-chat"
logger = logging.getLogger(__name__)


async def list_models() -> list[ModelCapabilities]:
    return await list_capabilities()


def stream_chat(
    *,
    agent: Any,
    session: Session,
    user_id: UUID,
    chat_request: AgentChatRequest,
) -> AsyncGenerator[Any]:
    async def run(controller: RunController) -> None:
        await _run(controller, agent, session, user_id, chat_request)

    stream: AsyncGenerator[Any] = create_run(
        run,
        state=chat_request.state,
    )

    return stream


async def _run(
    controller: RunController,
    agent: Any,
    session: Session,
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

        capabilities = await get_capabilities(
            chat_request.model or settings.DEFAULT_MODEL_NAME
        )

        if chat_request.thinking_enabled and not capabilities.supports_thinking:
            raise ThinkingNotSupportedError

        _validate_command_model_input(
            session=session,
            user_id=user_id,
            commands=chat_request.commands,
            capabilities=capabilities,
        )

        agent_config, input_messages = await _prepare_run(
            controller,
            agent,
            session,
            user_id,
            thread_id,
            chat_request.thread_id,
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
                context={
                    "model_name": capabilities.model_name,
                    "user_id": user_id,
                    "supports_vision": capabilities.supports_vision,
                    "supports_thinking": capabilities.supports_thinking,
                    "thinking_enabled": chat_request.thinking_enabled,
                },
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
    except ApplicationError as error:
        logger.warning("Agent 请求被拒绝: %s", type(error).__name__)
        controller.add_error(error.detail)
    except APIError:
        logger.exception(MODEL_REQUEST_ERROR_LOG)
        controller.add_error(ModelServiceUnavailableError.detail)
    except Exception:
        logger.exception(STREAM_ERROR_DETAIL)
        controller.add_error(STREAM_ERROR_DETAIL)
    finally:
        if events is not None:
            close = getattr(events, "aclose", None)

            if close is not None:
                await close()


def _validate_command_model_input(
    *,
    session: Session,
    user_id: UUID,
    commands: list[AgentCommand],
    capabilities: ModelCapabilities,
) -> None:
    has_image = False

    for command in commands:
        if not isinstance(command, AddMessageCommand):
            continue

        for part in command.message.parts:
            if isinstance(part, ImageMessagePart):
                stored_file = file_service.resolve_file_reference(
                    session=session,
                    user_id=user_id,
                    reference=part.image,
                )

                if not stored_file.content_type.startswith("image/"):
                    raise FileTypeNotAllowedError

                has_image = True

    if has_image and not capabilities.supports_vision:
        raise ImageInputNotSupportedError


async def _prepare_run(
    controller: RunController,
    agent: Any,
    session: Session,
    user_id: UUID,
    thread_id: str,
    conversation_id: UUID,
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
        messages_before_edit = [
            state_messages[index] for index in range(last_user_index)
        ]
        state_messages.clear()

        for state_message in messages_before_edit:
            state_messages.append(state_message)

    for command in commands:
        message: BaseMessage

        if isinstance(command, AddMessageCommand):
            message = refresh_message_file_urls(
                HumanMessage(
                    content=_to_content(
                        command,
                        session=session,
                        user_id=user_id,
                        conversation_id=conversation_id,
                    ),
                    id=str(uuid4()),
                ),
                user_id,
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

    session.commit()

    return agent_config, input_messages


def _to_content(
    command: AddMessageCommand,
    *,
    session: Session,
    user_id: UUID,
    conversation_id: UUID,
) -> list[str | dict[str, Any]]:
    content: list[str | dict[str, Any]] = []

    for part in command.message.parts:
        if isinstance(part, TextMessagePart):
            content.append({"type": "text", "text": part.text})
        elif isinstance(part, ImageMessagePart):
            content.append(
                _to_resource(
                    "image",
                    part.image,
                    session=session,
                    user_id=user_id,
                    conversation_id=conversation_id,
                )
            )
        elif isinstance(part, FileMessagePart):
            content.append(
                _to_resource(
                    "file",
                    part.data,
                    session=session,
                    user_id=user_id,
                    conversation_id=conversation_id,
                )
            )

    return content


def _to_resource(
    part_type: str,
    resource: str,
    *,
    session: Session,
    user_id: UUID,
    conversation_id: UUID,
) -> dict[str, Any]:
    stored_file = conversation_file_service.attach_file(
        session=session,
        user_id=user_id,
        conversation_id=conversation_id,
        reference=resource,
    )

    metadata = {
        "file_id": str(stored_file.id),
        "filename": stored_file.filename,
        "object_key": stored_file.object_key,
    }

    if part_type == "image":
        if not stored_file.content_type.startswith("image/"):
            raise FileTypeNotAllowedError

        return {
            "type": "image_url",
            "image_url": {"url": resource},
            "metadata": metadata,
        }

    return {
        "type": "file",
        "url": resource,
        "mime_type": stored_file.content_type,
        "metadata": metadata,
        "source_type": "url",
    }
