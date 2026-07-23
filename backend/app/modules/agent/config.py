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

    FIRECRAWL_API_KEY: SecretStr
    NEW_API_MCP_API_KEY: SecretStr

    E2B_API_KEY: SecretStr
    E2B_TEMPLATE: str | None = None

    COS_SECRET_ID: SecretStr
    COS_SECRET_KEY: SecretStr
    COS_REGION: str
    COS_BUCKET: str


settings = AgentSettings.model_validate({})
