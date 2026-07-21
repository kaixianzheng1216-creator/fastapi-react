from pathlib import Path
from typing import Any

from deepagents import create_deep_agent
from langchain.chat_models import init_chat_model
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

from app.modules.agent.config import settings
from app.modules.agent.connections.exa import load_exa_tools
from app.modules.agent.exceptions import AgentNotConfiguredError
from app.modules.agent.tools.generate_image import generate_image

SYSTEM_PROMPT = (
    (Path(__file__).parent / "prompts" / "system_prompt.md")
    .read_text(encoding="utf-8")
    .strip()
)


async def create_agent(checkpointer: AsyncPostgresSaver) -> Any:
    provider = settings.MODEL_PROVIDER
    model_name = settings.MODEL_NAME
    api_key = settings.MODEL_API_KEY

    if provider is None or model_name is None or api_key is None:
        raise AgentNotConfiguredError

    tools = await load_exa_tools()
    tools.append(generate_image)

    model = init_chat_model(
        model=model_name,
        model_provider=provider,
        api_key=api_key.get_secret_value(),
    )

    return create_deep_agent(
        model=model,
        tools=tools,
        system_prompt=SYSTEM_PROMPT,
        checkpointer=checkpointer,
    )
