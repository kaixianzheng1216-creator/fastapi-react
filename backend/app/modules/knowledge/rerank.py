import logging
from collections.abc import Sequence
from dataclasses import replace
from typing import Annotated, Literal

import httpx
from pydantic import BaseModel, Field, ValidationError

from app.modules.knowledge.config import settings
from app.modules.knowledge.vector_store import SearchResult

logger = logging.getLogger(__name__)


class RerankData(BaseModel):
    scores: list[Annotated[float, Field(strict=True, ge=0, le=1, allow_inf_nan=False)]]


class RerankResponse(BaseModel):
    code: Literal[0]
    data: RerankData


def rerank_matches(
    *, query: str, matches: Sequence[SearchResult], limit: int
) -> list[SearchResult]:
    """按官方返回的同序分数重排，调用失败时保留向量检索顺序。"""
    if not matches:
        return []

    try:
        with httpx.Client(
            base_url=settings.NEWAPI_BASE_URL.rstrip("/") + "/",
            headers={
                "Authorization": f"Bearer {settings.NEWAPI_API_KEY.get_secret_value()}"
            },
            timeout=15.0,
        ) as client:
            response = client.post(
                "volcengine/rerank",
                json={
                    "rerank_model": settings.RERANK_MODEL,
                    "datas": [
                        {
                            "query": query,
                            "content": "\n".join([*match.section_path, match.content]),
                        }
                        for match in matches
                    ],
                },
            )

            response.raise_for_status()

            scores = RerankResponse.model_validate_json(response.content).data.scores

        if len(scores) != len(matches):
            raise ValueError("重排分数数量与候选片段数量不一致")

    except (httpx.HTTPError, ValidationError, ValueError) as error:
        logger.warning("知识库重排失败，回退向量检索：%s", type(error).__name__)

        return list(matches[:limit])

    ranked = [
        replace(match, score=score)
        for match, score in zip(matches, scores, strict=True)
    ]

    return sorted(ranked, key=lambda match: match.score, reverse=True)[:limit]
