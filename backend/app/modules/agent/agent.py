from operator import add
from pathlib import Path
from typing import Annotated, Any, TypedDict
from uuid import UUID

from deepagents import FilesystemPermission, create_deep_agent
from deepagents.backends import CompositeBackend, FilesystemBackend, StoreBackend
from deepagents.graph import DeepAgentState
from langchain.agents.middleware import wrap_model_call
from langchain_core.language_models import BaseChatModel
from langchain_deepseek import ChatDeepSeek
from langchain_moonshot import ChatMoonshot
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.config import get_config
from langgraph.store.postgres.aio import AsyncPostgresStore
from sqlmodel import Session

from app.db.session import engine
from app.modules.agent.config import settings
from app.modules.agent.connections.litellm_mcp import load_litellm_mcp_tools
from app.modules.agent.exceptions import ModelNotAvailableError
from app.modules.agent.file_messages import prepare_message_file_inputs
from app.modules.agent.model_capabilities import ModelCapabilities
from app.modules.agent.sandbox import get_sandbox
from app.modules.agent.skill_sync import (
    BUILTIN_SKILLS_DIRECTORY,
    BUILTIN_SKILLS_PATH,
    USER_SKILLS_PATH,
    SkillSandboxMiddleware,
)
from app.modules.agent.tools.publish_artifact import (
    Artifact,
    load_publish_artifact_tools,
)
from app.modules.skills.service import get_skill_namespace

AGENT_DIRECTORY = Path(__file__).parent
SYSTEM_PROMPT = (
    (AGENT_DIRECTORY / "prompts" / "system_prompt.md")
    .read_text(encoding="utf-8")
    .strip()
)
DEEPSEEK_MODEL_PREFIX = "deepseek/"
MOONSHOT_MODEL_PREFIX = "moonshot/"


class AgentContext(TypedDict):
    model_name: str
    user_id: UUID
    conversation_id: UUID
    supports_vision: bool
    supports_thinking: bool
    thinking_enabled: bool


class AgentState(DeepAgentState):
    artifacts: Annotated[list[Artifact], add]


async def create_agent(
    checkpointer: AsyncPostgresSaver,
    store: AsyncPostgresStore,
) -> Any:
    tools = await load_litellm_mcp_tools()
    tools.extend(load_publish_artifact_tools())

    return create_deep_agent(
        model=create_chat_model(),
        tools=tools,
        middleware=[SkillSandboxMiddleware(), select_chat_model],
        system_prompt=SYSTEM_PROMPT,
        skills=[BUILTIN_SKILLS_PATH, USER_SKILLS_PATH],
        backend=lambda runtime: CompositeBackend(
            default=get_sandbox(get_config()["configurable"]["thread_id"]),
            routes={
                BUILTIN_SKILLS_PATH: FilesystemBackend(
                    root_dir=BUILTIN_SKILLS_DIRECTORY,
                    virtual_mode=True,
                ),
                USER_SKILLS_PATH: StoreBackend(
                    namespace=lambda skill_runtime: get_skill_namespace(
                        skill_runtime.context["user_id"]
                    )
                ),
            },
        ),
        permissions=[
            FilesystemPermission(
                operations=["write"],
                paths=["/skills/**"],
                mode="deny",
            )
        ],
        context_schema=AgentContext,
        state_schema=AgentState,
        checkpointer=checkpointer,
        store=store,
    )


def create_chat_model(
    *,
    model_name: str | None = None,
    thinking_enabled: bool | None = None,
) -> BaseChatModel:
    selected_model_name = model_name or settings.DEFAULT_MODEL_NAME
    api_base = str(settings.LITELLM_BASE_URL)

    if selected_model_name.startswith(DEEPSEEK_MODEL_PREFIX):
        extra_body = None

        if thinking_enabled is not None:
            thinking_type = "enabled" if thinking_enabled else "disabled"
            extra_body = {"thinking": {"type": thinking_type}}

        return ChatDeepSeek(
            model=selected_model_name,
            api_key=settings.LITELLM_API_KEY,
            base_url=api_base,
            extra_body=extra_body,
            output_version="v1",
            streaming=True,
        )

    if selected_model_name.startswith(MOONSHOT_MODEL_PREFIX):
        return ChatMoonshot(
            model=selected_model_name,
            api_key=settings.LITELLM_API_KEY,
            base_url=api_base,
            output_version="v1",
            thinking=thinking_enabled,
            streaming=True,
        )

    raise ModelNotAvailableError


@wrap_model_call
async def select_chat_model(request: Any, handler: Any) -> Any:
    assert request.runtime is not None

    context = request.runtime.context

    capabilities = ModelCapabilities(
        model_name=context["model_name"],
        supports_vision=context["supports_vision"],
        supports_thinking=context["supports_thinking"],
    )

    with Session(engine) as session:
        messages = [
            prepare_message_file_inputs(
                message,
                context["user_id"],
                session,
                capabilities.supports_vision,
            )
            for message in request.messages
        ]

    return await handler(
        request.override(
            messages=messages,
            model=create_chat_model(
                model_name=capabilities.model_name,
                thinking_enabled=(
                    context["thinking_enabled"]
                    if capabilities.supports_thinking
                    else None
                ),
            ),
        )
    )
