import json
import logging
from collections.abc import AsyncGenerator
from pathlib import Path
from typing import Any
from uuid import UUID

from assistant_stream import RunController, create_run  # type: ignore[import-untyped]
from assistant_stream.modules.langgraph import (  # type: ignore[import-untyped]
    append_langgraph_event,
)
from deepagents import create_deep_agent
from langchain_core.messages import BaseMessage, HumanMessage, ToolMessage
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
    input_messages = _convert_commands_to_messages(chat_request.commands)
    thread_id = f"{user_id}:{chat_request.thread_id}"

    try:
        if controller.state is None:
            controller.state = {"messages": []}
        elif "messages" not in controller.state:
            controller.state["messages"] = []

        for message in input_messages:
            controller.state["messages"].append(message.model_dump())

        with propagate_attributes(
            trace_name=TRACE_NAME,
            user_id=str(user_id),
            session_id=thread_id,
        ):
            async for namespace, stream_mode, event_data in agent.astream(
                {"messages": input_messages},
                config={
                    "configurable": {"thread_id": thread_id},
                    "callbacks": [CallbackHandler()],
                },
                stream_mode=["messages", "updates"],
                subgraphs=True,
            ):
                append_langgraph_event(
                    controller.state,
                    namespace,
                    stream_mode,
                    event_data,
                )
    except Exception:
        logger.exception(STREAM_ERROR_DETAIL)
        controller.add_error(STREAM_ERROR_DETAIL)


def _convert_commands_to_messages(
    commands: list[AgentCommand],
) -> list[BaseMessage]:
    messages: list[BaseMessage] = []

    for command in commands:
        if isinstance(command, AddMessageCommand):
            content = "".join(part.text for part in command.message.parts)
            messages.append(HumanMessage(content=content))

        else:
            if isinstance(command.result, str):
                content = command.result
            else:
                content = json.dumps(command.result, ensure_ascii=False)

            messages.append(
                ToolMessage(
                    content=content,
                    tool_call_id=command.tool_call_id,
                )
            )

    return messages
