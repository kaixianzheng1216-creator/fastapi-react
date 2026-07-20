import asyncio
import json
import logging
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any, cast
from uuid import UUID

from deepagents import create_deep_agent
from langchain_core.messages import BaseMessage
from langchain_deepseek import ChatDeepSeek
from langfuse import propagate_attributes
from langfuse.langchain import CallbackHandler
from langgraph.checkpoint.memory import InMemorySaver

from app.core.config import settings
from app.modules.agent.connections.exa import load_exa_tools
from app.modules.agent.exceptions import AgentNotConfiguredError

SYSTEM_PROMPT = (
    Path(__file__).with_name("instructions.md").read_text(encoding="utf-8").strip()
)
STREAM_ERROR_DETAIL = "Agent 流式响应失败"
TRACE_NAME = "agent-chat"
logger = logging.getLogger(__name__)
_agent: Any | None = None
_agent_lock = asyncio.Lock()


async def stream_chat(
    *,
    user_id: UUID,
    conversation_id: UUID,
    message: str,
) -> AsyncIterator[str]:
    current_agent = await _get_agent()
    events = _generate_events(current_agent, user_id, conversation_id, message)

    return events


async def _get_agent() -> Any:
    global _agent

    async with _agent_lock:
        if _agent is None:
            _agent = await _create_agent()

        return _agent


async def _create_agent() -> Any:
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
        checkpointer=InMemorySaver(),
    )

    return new_agent


async def _generate_events(
    agent: Any,
    user_id: UUID,
    conversation_id: UUID,
    message: str,
) -> AsyncIterator[str]:
    input_state = {"messages": [{"role": "user", "content": message}]}
    thread_id = f"{user_id}:{conversation_id}"
    config = {
        "configurable": {"thread_id": thread_id},
        "callbacks": [CallbackHandler()],
    }

    try:
        with propagate_attributes(
            trace_name=TRACE_NAME,
            user_id=str(user_id),
            session_id=thread_id,
        ):
            stream = agent.astream(
                input_state,
                config=config,
                stream_mode="messages",
                version="v2",
            )

            async for stream_part in stream:
                if stream_part["ns"]:
                    continue

                message_chunk, _ = cast(
                    "tuple[BaseMessage, dict[str, Any]]",
                    stream_part["data"],
                )

                reasoning_delta = message_chunk.additional_kwargs.get(
                    "reasoning_content"
                )
                if isinstance(reasoning_delta, str) and reasoning_delta:
                    yield _encode_sse("reasoning", {"delta": reasoning_delta})

                text_delta = message_chunk.text
                if text_delta:
                    yield _encode_sse("text", {"delta": text_delta})
    except Exception:
        logger.exception(STREAM_ERROR_DETAIL)
        yield _encode_sse("error", {"detail": STREAM_ERROR_DETAIL})

        return

    yield _encode_sse("done")


def _encode_sse(event: str, data: dict[str, str] | None = None) -> str:
    payload = json.dumps(data or {}, ensure_ascii=False)

    return f"event: {event}\ndata: {payload}\n\n"
