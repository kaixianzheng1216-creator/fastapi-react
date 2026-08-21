from pathlib import Path

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class KnowledgeSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[4] / ".env",
        env_ignore_empty=True,
        extra="ignore",
    )

    QDRANT_URL: str = "http://localhost:6333"
    LITELLM_BASE_URL: str
    LITELLM_API_KEY: SecretStr
    KNOWLEDGE_EMBEDDING_MODEL: str = "knowledge-embedding"
    KNOWLEDGE_TOKENIZER: str = "BAAI/bge-m3"
    KNOWLEDGE_EMBEDDING_MAX_INPUT_TOKENS: int = 8000
    KNOWLEDGE_EMBEDDING_BATCH_MAX_TOKENS: int = 50_000
    KNOWLEDGE_EMBEDDING_BATCH_SIZE: int = 64


settings = KnowledgeSettings.model_validate({})
