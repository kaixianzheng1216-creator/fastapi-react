import re
from dataclasses import dataclass
from datetime import UTC, datetime
from functools import partial
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import Response, sync_playwright
from pydantic import BaseModel, ValidationError

from app.modules.content_operations.constants import (
    BILIBILI_RANKING_CATEGORIES,
    BilibiliRankingCategory,
    BilibiliRankingCategoryCode,
)

BILIBILI_RANKING_PAGE_URL = "https://www.bilibili.com/v/popular/rank/all"
BILIBILI_RANKING_API_PATH = "/x/web-interface/ranking/v2"
BILIBILI_TIMEOUT_MS = 30_000


class _BilibiliOwner(BaseModel):
    name: str


class _BilibiliStatistics(BaseModel):
    view: int
    danmaku: int


class _BilibiliRankingItem(BaseModel):
    bvid: str
    title: str
    pic: str
    duration: int
    pubdate: int
    tnamev2: str
    owner: _BilibiliOwner
    stat: _BilibiliStatistics


class _BilibiliRankingData(BaseModel):
    list: list[_BilibiliRankingItem]


class _BilibiliRankingResponse(BaseModel):
    code: int
    message: str
    data: _BilibiliRankingData | None = None


@dataclass(frozen=True, slots=True)
class BilibiliRankingEntry:
    ranking_category_code: BilibiliRankingCategoryCode
    rank: int
    bvid: str
    title: str
    cover_url: str
    duration_seconds: int
    author_name: str
    content_category_name: str
    view_count: int
    danmaku_count: int
    published_at: datetime


class BilibiliRankingUnavailableError(RuntimeError):
    """B 站排行榜采集失败。"""


def fetch_bilibili_rankings() -> list[BilibiliRankingEntry]:
    """通过未登录浏览器获取 B 站各分区的真实排行榜。"""
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)

            try:
                page = browser.new_page(locale="zh-CN")

                all_category = BILIBILI_RANKING_CATEGORIES[0]

                matches_category_response = partial(
                    _is_category_response,
                    category=all_category,
                )

                with page.expect_response(
                    matches_category_response,
                    timeout=BILIBILI_TIMEOUT_MS,
                ) as response_info:
                    page.goto(
                        BILIBILI_RANKING_PAGE_URL,
                        wait_until="domcontentloaded",
                        timeout=BILIBILI_TIMEOUT_MS,
                    )

                entries = _parse_category_response(
                    all_category,
                    response_info.value,
                )

                for category in BILIBILI_RANKING_CATEGORIES[1:]:
                    category_name_pattern = re.compile(
                        rf"^\s*{re.escape(category.name)}\s*$"
                    )

                    tab = page.locator("li").filter(has_text=category_name_pattern)

                    matches_category_response = partial(
                        _is_category_response,
                        category=category,
                    )

                    with page.expect_response(
                        matches_category_response,
                        timeout=BILIBILI_TIMEOUT_MS,
                    ) as response_info:
                        tab.click()

                    entries.extend(
                        _parse_category_response(category, response_info.value)
                    )
            finally:
                browser.close()
    except (
        OSError,
        OverflowError,
        PlaywrightError,
        ValidationError,
        ValueError,
    ) as error:
        raise BilibiliRankingUnavailableError("B 站排行榜暂时无法获取") from error

    return entries


def _is_category_response(
    response: Response,
    category: BilibiliRankingCategory,
) -> bool:
    parsed_url = urlparse(response.url)
    parameters = parse_qs(parsed_url.query)
    expected_rid = str(category.rid)

    return parsed_url.path == BILIBILI_RANKING_API_PATH and parameters.get("rid") == [
        expected_rid
    ]


def _parse_category_response(
    category: BilibiliRankingCategory,
    response: Response,
) -> list[BilibiliRankingEntry]:
    source = _BilibiliRankingResponse.model_validate(response.json())

    if source.code != 0 or source.data is None or not source.data.list:
        raise BilibiliRankingUnavailableError(
            f"B 站{category.name}排行榜获取失败："
            f"code={source.code}, message={source.message}"
        )

    entries: list[BilibiliRankingEntry] = []

    for rank, item in enumerate(source.data.list, start=1):
        entries.append(
            BilibiliRankingEntry(
                ranking_category_code=category.code,
                rank=rank,
                bvid=item.bvid,
                title=item.title,
                cover_url=_normalize_cover_url(item.pic),
                duration_seconds=item.duration,
                author_name=item.owner.name,
                content_category_name=item.tnamev2,
                view_count=item.stat.view,
                danmaku_count=item.stat.danmaku,
                published_at=datetime.fromtimestamp(item.pubdate, UTC),
            )
        )

    return entries


def _normalize_cover_url(value: str) -> str:
    if value.startswith("http://"):
        return f"https://{value.removeprefix('http://')}"

    return value
