from pathlib import Path
from typing import Annotated

from pydantic import Field, SecretStr, model_validator
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
    EMBEDDING_VECTOR_SIZE: Annotated[int, Field(gt=0)]
    EMBEDDING_MAX_INPUT_TOKENS: Annotated[int, Field(gt=0)]
    EMBEDDING_MAX_BATCH_TOKENS: Annotated[int, Field(gt=0)]
    EMBEDDING_MAX_BATCH_SIZE: Annotated[int, Field(gt=0)]

    @model_validator(mode="after")
    def validate_embedding_batch(self) -> KnowledgeSettings:
        if self.EMBEDDING_MAX_BATCH_TOKENS < self.EMBEDDING_MAX_INPUT_TOKENS:
            raise ValueError("Embedding 批次 Token 上限不能小于单条输入上限")

        return self


settings = KnowledgeSettings.model_validate({})
