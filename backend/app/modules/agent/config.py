from pathlib import Path

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class AgentSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[4] / ".env",
        env_ignore_empty=True,
        extra="ignore",
    )

    LITELLM_BASE_URL: str
    LITELLM_API_KEY: SecretStr
    DEFAULT_MODEL_NAME: str

    E2B_API_KEY: SecretStr
    E2B_TEMPLATE: str


settings = AgentSettings.model_validate({})
