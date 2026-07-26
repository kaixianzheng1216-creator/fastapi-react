from pathlib import Path
from typing import Any, TypedDict

from deepagents import FilesystemPermission, create_deep_agent
from deepagents.backends import CompositeBackend, FilesystemBackend
from langchain.agents.middleware import wrap_model_call
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.config import get_config

from app.modules.agent.config import settings
from app.modules.agent.connections.firecrawl import load_firecrawl_tools
from app.modules.agent.connections.new_api import load_new_api_tools
from app.modules.agent.connections.xiaohongshu import load_xiaohongshu_tools
from app.modules.agent.sandbox import get_sandbox
from app.modules.agent.tools.publish_artifact import load_publish_artifact_tools

AGENT_DIRECTORY = Path(__file__).parent
SKILLS_PATH = "/skills/"
SYSTEM_PROMPT = (
    (AGENT_DIRECTORY / "prompts" / "system_prompt.md")
    .read_text(encoding="utf-8")
    .strip()
)


class AgentContext(TypedDict):
    model_name: str | None


def create_chat_model(*, model_name: str | None = None) -> BaseChatModel:
    return ChatOpenAI(
        model=model_name or settings.DEFAULT_MODEL_NAME,
        api_key=settings.LITELLM_API_KEY,
        base_url=settings.LITELLM_BASE_URL,
        use_responses_api=False,
    )


@wrap_model_call
async def select_chat_model(request: Any, handler: Any) -> Any:
    assert request.runtime is not None

    return await handler(
        request.override(
            model=create_chat_model(
                model_name=request.runtime.context["model_name"],
            )
        )
    )


async def create_agent(checkpointer: AsyncPostgresSaver) -> Any:
    tools = await load_firecrawl_tools()
    tools.extend(await load_new_api_tools())
    tools.extend(await load_xiaohongshu_tools())
    tools.extend(load_publish_artifact_tools(settings))

    return create_deep_agent(
        model=create_chat_model(),
        tools=tools,
        middleware=[select_chat_model],
        system_prompt=SYSTEM_PROMPT,
        skills=[SKILLS_PATH],
        backend=lambda runtime: CompositeBackend(
            default=get_sandbox(get_config()["configurable"]["thread_id"]),
            routes={
                SKILLS_PATH: FilesystemBackend(
                    root_dir=AGENT_DIRECTORY / "skills",
                    virtual_mode=True,
                )
            },
        ),
        permissions=[
            FilesystemPermission(
                operations=["write"],
                paths=[f"{SKILLS_PATH}**"],
                mode="deny",
            )
        ],
        context_schema=AgentContext,
        checkpointer=checkpointer,
    )
