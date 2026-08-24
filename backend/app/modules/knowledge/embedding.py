from collections.abc import Sequence
from functools import cache
from itertools import batched

from docling_core.transforms.chunker.tokenizer.huggingface import (
    HuggingFaceTokenizer,
)
from openai import APIError, APITimeoutError, OpenAI

from app.modules.knowledge.config import settings


class EmbeddingServiceError(Exception):
    pass


class EmbeddingTimeoutError(EmbeddingServiceError):
    pass


@cache
def get_tokenizer() -> HuggingFaceTokenizer:
    return HuggingFaceTokenizer.from_pretrained(
        settings.EMBEDDING_TOKENIZER,
        max_tokens=settings.EMBEDDING_CHUNK_MAX_TOKENS,
    )


def embed_texts(texts: Sequence[str]) -> list[list[float]]:
    if not texts:
        return []

    vectors: list[list[float]] = []

    try:
        with OpenAI(
            api_key=settings.LITELLM_API_KEY.get_secret_value(),
            base_url=settings.LITELLM_BASE_URL,
        ) as client:
            for text_batch in batched(
                texts,
                settings.EMBEDDING_BATCH_SIZE,
                strict=False,
            ):
                response = client.embeddings.create(
                    model=settings.EMBEDDING_MODEL,
                    input=list(text_batch),
                )

                if len(response.data) != len(text_batch):
                    raise EmbeddingServiceError("Embedding 服务返回结果无效")

                response_data = sorted(response.data, key=lambda item: item.index)

                for expected_index, item in enumerate(response_data):
                    if (
                        item.index != expected_index
                        or len(item.embedding) != settings.EMBEDDING_DIMENSIONS
                    ):
                        raise EmbeddingServiceError("Embedding 服务返回结果无效")

                    vectors.append(item.embedding)
    except APITimeoutError as error:
        raise EmbeddingTimeoutError from error
    except APIError as error:
        raise EmbeddingServiceError from error

    return vectors
