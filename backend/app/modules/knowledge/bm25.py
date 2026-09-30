from functools import cache
from pathlib import Path

import jieba
from fastembed import SparseTextEmbedding
from qdrant_client.http import models


def embed_text(text: str, *, query: bool = False) -> models.SparseVector:
    """使用相同的中文分词生成文档或查询的 BM25 稀疏向量。"""
    text = " ".join(jieba.cut(text))

    model = _get_model()

    if query:
        embedding = next(iter(model.query_embed(text)))
    else:
        embedding = next(iter(model.embed([text])))

    return models.SparseVector(
        indices=embedding.indices.tolist(),
        values=embedding.values.tolist(),
    )


@cache
def _get_model() -> SparseTextEmbedding:
    return SparseTextEmbedding(
        model_name="Qdrant/bm25",
        disable_stemmer=True,
        specific_model_path=str(Path(__file__).parent),
    )
