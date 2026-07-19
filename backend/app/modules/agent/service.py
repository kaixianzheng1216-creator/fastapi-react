import json
import logging
from collections.abc import AsyncIterator
from functools import cache
from typing import Any, cast
from uuid import UUID

from deepagents import create_deep_agent
from langchain_core.messages import BaseMessage
from langchain_deepseek import ChatDeepSeek
from langgraph.checkpoint.memory import InMemorySaver

from app.core.config import settings
from app.modules.agent.exceptions import AgentNotConfiguredError

SYSTEM_PROMPT = "你是一个乐于助人的 AI 助手。除非用户另有要求，否则使用中文回答。"
STREAM_ERROR_DETAIL = "Agent 流式响应失败"
logger = logging.getLogger(__name__)


def stream_chat(
    *,
    user_id: UUID,
    conversation_id: UUID,
    message: str,
) -> AsyncIterator[str]:
    agent = _get_agent()
    thread_id = f"{user_id}:{conversation_id}"
    events = _generate_events(agent, thread_id, message)

    return events


@cache
def _get_agent() -> Any:
    if not settings.DEEPSEEK_API_KEY:
        raise AgentNotConfiguredError

    model = ChatDeepSeek(
        model=settings.DEEPSEEK_MODEL,
        api_key=settings.DEEPSEEK_API_KEY,
        reasoning_effort="high",
        extra_body={"thinking": {"type": "enabled"}},
    )

    return create_deep_agent(
        model=model,
        system_prompt=SYSTEM_PROMPT,
        checkpointer=InMemorySaver(),
    )


async def _generate_events(
    agent: Any,
    thread_id: str,
    message: str,
) -> AsyncIterator[str]:
    input_state = {"messages": [{"role": "user", "content": message}]}
    config = {"configurable": {"thread_id": thread_id}}

    try:
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

            reasoning_delta = message_chunk.additional_kwargs.get("reasoning_content")
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
