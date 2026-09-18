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

    IMAGE_DESCRIPTION_PROMPT: Annotated[str, Field(min_length=1)]

    NEWAPI_BASE_URL: str
    NEWAPI_API_KEY: SecretStr

    EMBEDDING_MODEL: str

    RERANK_MODEL: str = "doubao-seed-rerank"

    EMBEDDING_DIMENSIONS: Annotated[int, Field(gt=0)]
    EMBEDDING_CHUNK_MAX_TOKENS: Annotated[int, Field(gt=0)]
    EMBEDDING_TABLE_CHUNK_MAX_TOKENS: Annotated[int, Field(gt=0)]

    EMBEDDING_TOKENIZER: str

    KNOWLEDGE_MAX_CONCURRENT_DOCUMENTS: Annotated[int, Field(gt=0)] = 3
    KNOWLEDGE_LARGE_FILE_THRESHOLD_MB: Annotated[int, Field(gt=0)] = 15
    KNOWLEDGE_LARGE_FILE_WAIT_SECONDS: Annotated[int, Field(ge=0)] = 30


settings = KnowledgeSettings.model_validate({})
