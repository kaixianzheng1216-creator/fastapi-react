from collections.abc import Iterator, Sequence
from functools import cache

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


def _iter_text_batches(texts: Sequence[str]) -> Iterator[list[str]]:
    """按条数和模型补齐后的 Token 数量分批。"""
    tokenizer = get_tokenizer()
    huggingface_tokenizer = tokenizer.tokenizer
    text_batch: list[str] = []
    longest_text_tokens = 0

    for text in texts:
        text_tokens = len(huggingface_tokenizer.encode(text, add_special_tokens=True))
        padded_tokens = (len(text_batch) + 1) * max(
            longest_text_tokens,
            text_tokens,
        )

        if text_batch and (
            len(text_batch) >= settings.EMBEDDING_BATCH_SIZE
            or padded_tokens > settings.EMBEDDING_BATCH_MAX_TOKENS
        ):
            yield text_batch
            text_batch = []
            longest_text_tokens = 0

        if text_tokens > settings.EMBEDDING_BATCH_MAX_TOKENS:
            raise EmbeddingServiceError("Embedding 文本超过单次请求限制")

        text_batch.append(text)
        longest_text_tokens = max(longest_text_tokens, text_tokens)

    if text_batch:
        yield text_batch


def embed_texts(texts: Sequence[str]) -> list[list[float]]:
    if not texts:
        return []

    vectors: list[list[float]] = []

    try:
        with OpenAI(
            api_key=settings.LITELLM_API_KEY.get_secret_value(),
            base_url=settings.LITELLM_BASE_URL,
        ) as client:
            for text_batch in _iter_text_batches(texts):
                response = client.embeddings.create(
                    model=settings.EMBEDDING_MODEL,
                    input=text_batch,
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
