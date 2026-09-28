import asyncio
from urllib.parse import urlsplit

import httpx
from pydantic import BaseModel

from app.core.config import settings
from app.modules.knowledge.exceptions import (
    WebpageScrapeError,
    WebpageScrapeUnavailableError,
    WebSearchTimeoutError,
    WebSearchUnavailableError,
)
from app.modules.knowledge.schemas import WebSearchResult

SCRAPE_URL = "https://api.firecrawl.dev/v2/scrape"
SCRAPE_TIMEOUT_SECONDS = 60


class _SearchData(BaseModel):
    web: list[WebSearchResult]


class _SearchResponse(BaseModel):
    success: bool
    data: _SearchData | None = None


async def search(query: str) -> list[WebSearchResult]:
    """只搜索网页摘要；选中后通过现有网页导入流程抓取正文。"""
    payload: dict[str, object] = {
        "query": query,
        "sources": ["web"],
        "limit": 50,
    }

    try:
        async with (
            asyncio.timeout(60),
            httpx.AsyncClient(timeout=httpx.Timeout(60, connect=10)) as client,
        ):
            response = await client.post(
                "https://api.firecrawl.dev/v2/search",
                headers={
                    "Authorization": f"Bearer {settings.FIRECRAWL_API_KEY.get_secret_value()}"
                },
                json=payload,
            )

        response.raise_for_status()

        result = _SearchResponse.model_validate(response.json())
    except TimeoutError, httpx.TimeoutException:
        raise WebSearchTimeoutError from None
    except (httpx.HTTPError, ValueError) as error:
        raise WebSearchUnavailableError from error

    if not result.success or result.data is None:
        raise WebSearchUnavailableError

    return result.data.web


class _ScrapeMetadata(BaseModel):
    title: str | None = None


class _ScrapeData(BaseModel):
    markdown: str
    metadata: _ScrapeMetadata


class _ScrapeResponse(BaseModel):
    success: bool
    data: _ScrapeData | None = None


async def scrape(url: str) -> tuple[str, str]:
    """抓取单个网页并返回 Markdown 和标题。"""
    try:
        async with httpx.AsyncClient(timeout=SCRAPE_TIMEOUT_SECONDS) as client:
            response = await client.post(
                SCRAPE_URL,
                headers={
                    "Authorization": (
                        f"Bearer {settings.FIRECRAWL_API_KEY.get_secret_value()}"
                    )
                },
                json={"url": url, "formats": ["markdown"]},
            )

        response.raise_for_status()

        result = _ScrapeResponse.model_validate(response.json())
    except httpx.HTTPStatusError as error:
        if error.response.status_code < 500 and error.response.status_code != 429:
            raise WebpageScrapeError from error

        raise WebpageScrapeUnavailableError from error
    except (httpx.RequestError, ValueError) as error:
        raise WebpageScrapeUnavailableError from error

    if not result.success or result.data is None or not result.data.markdown.strip():
        raise WebpageScrapeError

    title = " ".join((result.data.metadata.title or "").split())

    if not title:
        title = urlsplit(url).netloc

    return result.data.markdown, title
