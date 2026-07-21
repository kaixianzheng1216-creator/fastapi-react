from pathlib import Path
from typing import Any

from deepagents import create_deep_agent
from langchain_deepseek import ChatDeepSeek
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

from app.core.config import settings
from app.modules.agent.connections.exa import load_exa_tools
from app.modules.agent.exceptions import AgentNotConfiguredError

SYSTEM_PROMPT = (
    (Path(__file__).parent / "prompts" / "system_prompt.md")
    .read_text(encoding="utf-8")
    .strip()
)


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

    return create_deep_agent(
        model=model,
        tools=tools,
        system_prompt=SYSTEM_PROMPT,
        checkpointer=checkpointer,
    )
