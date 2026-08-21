from collections.abc import Sequence

from docling_core.transforms.chunker.tokenizer.huggingface import (
    HuggingFaceTokenizer,
)
from openai import APITimeoutError, OpenAI

from app.modules.knowledge.config import settings
from app.modules.knowledge.vector_store import VECTOR_SIZE

tokenizer = HuggingFaceTokenizer.from_pretrained(
    settings.KNOWLEDGE_TOKENIZER,
    max_tokens=settings.KNOWLEDGE_EMBEDDING_MAX_INPUT_TOKENS,
)


class EmbeddingInputTooLongError(Exception):
    pass


class EmbeddingTimeoutError(Exception):
    pass


def embed_texts(texts: Sequence[str]) -> list[list[float]]:
    if not texts:
        return []

    vectors: list[list[float]] = []
    batches: list[list[str]] = []
    batch: list[str] = []
    batch_tokens = 0

    for text in texts:
        token_count = tokenizer.count_tokens(text)

        if token_count > settings.KNOWLEDGE_EMBEDDING_MAX_INPUT_TOKENS:
            raise EmbeddingInputTooLongError("内容超过 Embedding 模型单条输入限制")

        if batch and (
            len(batch) >= settings.KNOWLEDGE_EMBEDDING_BATCH_SIZE
            or batch_tokens + token_count
            > settings.KNOWLEDGE_EMBEDDING_BATCH_MAX_TOKENS
        ):
            batches.append(batch)
            batch = []
            batch_tokens = 0

        batch.append(text)
        batch_tokens += token_count

    if batch:
        batches.append(batch)

    try:
        with OpenAI(
            api_key=settings.LITELLM_API_KEY.get_secret_value(),
            base_url=settings.LITELLM_BASE_URL,
        ) as client:
            for batch in batches:
                response = client.embeddings.create(
                    model=settings.KNOWLEDGE_EMBEDDING_MODEL,
                    input=batch,
                )
                vectors.extend(
                    item.embedding
                    for item in sorted(response.data, key=lambda item: item.index)
                )
    except APITimeoutError:
        raise EmbeddingTimeoutError from None

    if any(len(vector) != VECTOR_SIZE for vector in vectors):
        raise RuntimeError("Embedding 向量维度不匹配")

    return vectors
