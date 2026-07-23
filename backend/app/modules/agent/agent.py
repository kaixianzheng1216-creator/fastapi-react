from pathlib import Path
from typing import Any

from deepagents import FilesystemPermission, create_deep_agent
from deepagents.backends import CompositeBackend, FilesystemBackend
from langchain.chat_models import init_chat_model
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.config import get_config

from app.modules.agent.config import settings
from app.modules.agent.connections.exa import load_exa_tools
from app.modules.agent.connections.xiaohongshu import load_xiaohongshu_tools
from app.modules.agent.sandbox import get_sandbox
from app.modules.agent.tools.generate_image import load_image_tools
from app.modules.agent.tools.publish_artifact import load_publish_artifact_tools

AGENT_DIRECTORY = Path(__file__).parent
SKILLS_PATH = "/skills/"
SYSTEM_PROMPT = (
    (AGENT_DIRECTORY / "prompts" / "system_prompt.md")
    .read_text(encoding="utf-8")
    .strip()
)


async def create_agent(
    checkpointer: AsyncPostgresSaver,
) -> Any:
    provider = settings.MODEL_PROVIDER
    model_name = settings.MODEL_NAME
    api_key = settings.MODEL_API_KEY

    tools = await load_exa_tools()
    tools.extend(await load_xiaohongshu_tools())
    tools.extend(load_image_tools())
    tools.extend(load_publish_artifact_tools(settings))

    if provider == "deepseek":
        model = init_chat_model(
            model=model_name,
            model_provider=provider,
            api_key=api_key.get_secret_value(),
            reasoning_effort="high",
            extra_body={"thinking": {"type": "enabled"}},
        )
    else:
        model = init_chat_model(
            model=model_name,
            model_provider=provider,
            api_key=api_key.get_secret_value(),
        )

    return create_deep_agent(
        model=model,
        tools=tools,
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
        checkpointer=checkpointer,
    )
