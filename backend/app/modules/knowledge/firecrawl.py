import httpx
from pydantic import BaseModel

from app.core.config import settings
from app.modules.knowledge.exceptions import (
    WebpageScrapeError,
    WebpageScrapeUnavailableError,
)

SCRAPE_URL = "https://api.firecrawl.dev/v2/scrape"
SCRAPE_TIMEOUT_SECONDS = 60


class _ScrapeData(BaseModel):
    markdown: str


class _ScrapeResponse(BaseModel):
    success: bool
    data: _ScrapeData | None = None


async def scrape(url: str) -> str:
    """抓取单个网页并返回 Markdown。"""
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

    return result.data.markdown
