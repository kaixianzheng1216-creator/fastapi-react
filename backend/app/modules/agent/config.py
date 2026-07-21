from pathlib import Path

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class AgentSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[4] / ".env",
        env_ignore_empty=True,
        extra="ignore",
    )

    MODEL_PROVIDER: str
    MODEL_NAME: str
    MODEL_API_KEY: SecretStr

    EXA_API_KEY: SecretStr | None = None

    IMAGE_API_KEY: SecretStr | None = None
    IMAGE_BASE_URL: str | None = None
    IMAGE_MODEL: str | None = None


settings = AgentSettings.model_validate({})
