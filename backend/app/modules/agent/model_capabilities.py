from dataclasses import dataclass

from app.modules.agent.exceptions import ModelNotAvailableError


@dataclass(frozen=True)
class ModelCapabilities:
    model_name: str
    supports_vision: bool
    supports_thinking: bool


MODEL_CAPABILITIES = {
    "deepseek-flash": ModelCapabilities(
        model_name="deepseek-flash", supports_vision=True, supports_thinking=True
    ),
    "deepseek-v4-pro": ModelCapabilities(
        model_name="deepseek-v4-pro", supports_vision=False, supports_thinking=True
    ),
}


async def list_capabilities() -> list[ModelCapabilities]:
    return list(MODEL_CAPABILITIES.values())


async def get_capabilities(model_name: str) -> ModelCapabilities:
    try:
        return MODEL_CAPABILITIES[model_name]
    except KeyError:
        raise ModelNotAvailableError from None
