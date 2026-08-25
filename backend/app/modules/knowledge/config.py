from pathlib import Path
from typing import Annotated

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class KnowledgeSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[4] / ".env",
        env_ignore_empty=True,
        extra="ignore",
    )

    QDRANT_URL: str
    QDRANT_COLLECTION_NAME: str
    LITELLM_BASE_URL: str
    LITELLM_API_KEY: SecretStr
    EMBEDDING_MODEL: str
    EMBEDDING_TOKENIZER: str
    EMBEDDING_DIMENSIONS: Annotated[int, Field(gt=0)]
    EMBEDDING_CHUNK_MAX_TOKENS: Annotated[int, Field(gt=0)]
    EMBEDDING_BATCH_MAX_TOKENS: Annotated[int, Field(gt=0)]
    EMBEDDING_BATCH_SIZE: Annotated[int, Field(gt=0, le=100)]


settings = KnowledgeSettings.model_validate({})
