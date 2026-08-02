import logging
from dataclasses import dataclass

from openai import AsyncOpenAI, BaseModel
from pydantic import Field

from app.modules.agent.config import settings
from app.modules.agent.exceptions import (
    ModelNotAvailableError,
    ModelsUnavailableError,
)

THINKING_PARAMETER = "thinking"
MODEL_INFO_ERROR_LOG = "LiteLLM 模型能力请求失败"
logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ModelCapabilities:
    model_name: str
    supports_vision: bool
    supports_thinking: bool


class _ModelInfo(BaseModel):
    supports_vision: bool | None = None
    supported_openai_params: list[str] | None = None


class _Model(BaseModel):
    model_name: str
    model_info: _ModelInfo = Field(default_factory=_ModelInfo)


class _ModelInfoResponse(BaseModel):
    data: list[_Model]


async def list_capabilities() -> list[ModelCapabilities]:
    try:
        async with AsyncOpenAI(
            api_key=settings.LITELLM_API_KEY.get_secret_value(),
            base_url=settings.LITELLM_BASE_URL.removesuffix("/v1"),
        ) as client:
            response = await client.get(
                "/model/info",
                cast_to=_ModelInfoResponse,
            )
    except Exception as error:
        logger.exception(MODEL_INFO_ERROR_LOG)

        raise ModelsUnavailableError from error

    capabilities_by_name: dict[str, ModelCapabilities] = {}

    for model in response.data:
        model_info = model.model_info
        supports_thinking = False

        if model_info.supported_openai_params is not None:
            supports_thinking = THINKING_PARAMETER in model_info.supported_openai_params

        current_capabilities = ModelCapabilities(
            model_name=model.model_name,
            supports_vision=bool(model_info.supports_vision),
            supports_thinking=supports_thinking,
        )

        existing_capabilities = capabilities_by_name.get(model.model_name)

        if existing_capabilities is None:
            capabilities_by_name[model.model_name] = current_capabilities
            continue

        capabilities_by_name[model.model_name] = ModelCapabilities(
            model_name=model.model_name,
            supports_vision=(
                existing_capabilities.supports_vision
                and current_capabilities.supports_vision
            ),
            supports_thinking=(
                existing_capabilities.supports_thinking
                and current_capabilities.supports_thinking
            ),
        )

    return list(capabilities_by_name.values())


async def get_capabilities(model_name: str) -> ModelCapabilities:
    for capabilities in await list_capabilities():
        if capabilities.model_name == model_name:
            return capabilities

    raise ModelNotAvailableError
