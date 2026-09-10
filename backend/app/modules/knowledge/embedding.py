from collections.abc import Sequence
from functools import cache

import httpx
from docling_core.transforms.chunker.tokenizer.huggingface import (
    HuggingFaceTokenizer,
)

from app.modules.knowledge.config import settings


@cache
def get_tokenizer() -> HuggingFaceTokenizer:
    return HuggingFaceTokenizer.from_pretrained(
        settings.EMBEDDING_TOKENIZER,
        max_tokens=settings.EMBEDDING_CHUNK_MAX_TOKENS,
    )


def embed_texts(texts: Sequence[str]) -> list[list[float]]:
    """每个文本单独向量化；多模态 input 数组表示同一条内容的组成部分。"""
    if not texts:
        return []

    vectors: list[list[float]] = []

    with httpx.Client(
        base_url=settings.NEWAPI_BASE_URL.rstrip("/") + "/",
        headers={
            "Authorization": f"Bearer {settings.NEWAPI_API_KEY.get_secret_value()}"
        },
        timeout=60.0,
    ) as client:
        for text in texts:
            response = client.post(
                "embeddings",
                json={
                    "model": settings.EMBEDDING_MODEL,
                    "input": [{"type": "text", "text": text}],
                },
            )

            response.raise_for_status()

            vectors.append(response.json()["data"]["embedding"])

    return vectors
