from pathlib import Path

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class KnowledgeSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[4] / ".env",
        env_ignore_empty=True,
        extra="ignore",
    )

    QDRANT_URL: str
    LITELLM_BASE_URL: str
    LITELLM_API_KEY: SecretStr
    EMBEDDING_MODEL: str
    TOKENIZER: str


settings = KnowledgeSettings.model_validate({})
