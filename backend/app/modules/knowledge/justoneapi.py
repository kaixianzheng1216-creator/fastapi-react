import asyncio
import logging
from time import perf_counter
from typing import Literal
from urllib.parse import urlencode, urlsplit

import httpx
from pydantic import AliasPath, BaseModel, Field, HttpUrl, TypeAdapter

from app.core.config import settings
from app.modules.knowledge.exceptions import (
    SourceConfigurationError,
    SourceQuotaExceededError,
    WebpageScrapeError,
    WebpageScrapeUnavailableError,
    WebSearchTimeoutError,
    WebSearchUnavailableError,
)
from app.modules.knowledge.schemas import WebSearchPage, WebSearchResult

logger = logging.getLogger(__name__)


class _NoteContent(BaseModel):
    id: str
    title: str = ""
    desc: str


class _SearchNote(_NoteContent):
    xsec_token: str = Field(min_length=1)

    author: str | None = Field(
        default=None, validation_alias=AliasPath("user", "nickname")
    )
    cover: HttpUrl | None = Field(
        default=None, validation_alias=AliasPath("images_list", 0, "url")
    )
    timestamp: int | None = None

    liked_count: int | None = None
    comments_count: int | None = None
    collected_count: int | None = None


class _NoteItem(BaseModel):
    note: _SearchNote | None = None


class _Notes(BaseModel):
    items: list[_NoteItem]


class _PostContent(BaseModel):
    aweme_id: str
    desc: str
    item_title: str = ""


class _Post(_PostContent):
    author: str | None = Field(
        default=None, validation_alias=AliasPath("author", "nickname")
    )
    cover_urls: list[HttpUrl] = Field(
        default_factory=list, validation_alias=AliasPath("images", 0, "url_list")
    )
    create_time: int | None = None

    likes: int | None = Field(
        default=None, validation_alias=AliasPath("statistics", "digg_count")
    )
    comments: int | None = Field(
        default=None, validation_alias=AliasPath("statistics", "comment_count")
    )
    collects: int | None = Field(
        default=None, validation_alias=AliasPath("statistics", "collect_count")
    )


class _PostItem(BaseModel):
    post: _Post | None = Field(
        default=None, validation_alias=AliasPath("data", "aweme_info")
    )


class _Posts(BaseModel):
    business_data: list[_PostItem]
    has_more: bool = Field(validation_alias=AliasPath("business_config", "has_more"))
    search_id: str | None = Field(
        default=None,
        validation_alias=AliasPath("business_config", "next_page", "search_id"),
    )


class _Response(BaseModel):
    code: int
    data: object
    request_id: str | None = Field(default=None, validation_alias="requestId")


async def _get(path: str, params: dict[str, str | int]) -> object:
    if settings.JUSTONEAPI_TOKEN is None:
        logger.warning("JustOneAPI 未配置访问令牌")

        raise SourceConfigurationError

    started_at = perf_counter()

    try:
        async with (
            asyncio.timeout(60),
            httpx.AsyncClient(timeout=httpx.Timeout(60, connect=10)) as client,
        ):
            response = await client.get(
                f"https://api.justoneapi.com{path}",
                params={
                    "token": settings.JUSTONEAPI_TOKEN.get_secret_value(),
                    **params,
                },
            )

        response.raise_for_status()

        api_response = _Response.model_validate(response.json())
    except (TimeoutError, httpx.TimeoutException) as error:
        logger.warning(
            "JustOneAPI 请求超时：接口=%s 耗时=%.2f秒 异常类型=%s",
            path,
            perf_counter() - started_at,
            type(error).__name__,
        )

        raise WebSearchTimeoutError from None
    except (httpx.HTTPError, ValueError) as error:
        logger.warning(
            "JustOneAPI 请求失败：接口=%s 耗时=%.2f秒 异常类型=%s",
            path,
            perf_counter() - started_at,
            type(error).__name__,
        )

        raise WebSearchUnavailableError from None

    if api_response.code != 0:
        logger.warning(
            "JustOneAPI 业务请求失败：接口=%s 耗时=%.2f秒 业务码=%s 请求ID=%s",
            path,
            perf_counter() - started_at,
            api_response.code,
            api_response.request_id,
        )

        if api_response.code == 100:
            raise SourceConfigurationError

        if api_response.code == 303:
            raise SourceQuotaExceededError

        raise WebSearchUnavailableError

    logger.info(
        "JustOneAPI 请求成功：接口=%s 耗时=%.2f秒 请求ID=%s",
        path,
        perf_counter() - started_at,
        api_response.request_id,
    )

    return api_response.data


async def search(
    query: str,
    source: Literal["xiaohongshu", "douyin"],
    page: int = 1,
    search_id: str | None = None,
) -> WebSearchPage:
    params: dict[str, str | int] = {"keyword": query}

    if source == "xiaohongshu":
        path = "/api/xiaohongshu/search-note/v2"

        params["page"] = page
    else:
        path = "/api/douyin/search-image/v1"

        if search_id is not None:
            params["searchId"] = search_id

    data = await _get(path, params)

    try:
        if source == "xiaohongshu":
            return _parse_xiaohongshu(data, page)

        return _parse_douyin(data, page)
    except ValueError:
        logger.warning("JustOneAPI 搜索响应结构不符合预期：接口=%s", path)

        raise WebSearchUnavailableError from None


def _parse_xiaohongshu(data: object, page: int) -> WebSearchPage:
    results: list[WebSearchResult] = []

    search_response = _Notes.model_validate(data)

    for item in search_response.items:
        note = item.note

        if note is None:
            continue

        title = note.title

        if not title:
            title = note.desc[:80]

        if not title:
            title = "小红书笔记"

        cover_url: HttpUrl | None = None

        if note.cover is not None:
            cover_url = HttpUrl(
                str(note.cover).replace("/format/heif/", "/format/webp/")
            )

        results.append(
            WebSearchResult(
                url=HttpUrl(
                    f"https://www.xiaohongshu.com/explore/{note.id}?"
                    + urlencode(
                        {"xsec_token": note.xsec_token, "xsec_source": "pc_search"}
                    )
                ),
                title=title,
                description=note.desc,
                cover_url=cover_url,
                author=note.author,
                published_at=note.timestamp,
                likes=note.liked_count,
                comments=note.comments_count,
                collects=note.collected_count,
            )
        )

    return WebSearchPage(items=results, next_page=page + 1)


def _parse_douyin(data: object, page: int) -> WebSearchPage:
    results: list[WebSearchResult] = []

    search_response = _Posts.model_validate(data)

    for item in search_response.business_data:
        post = item.post

        if post is None:
            continue

        title = post.item_title

        if not title:
            title = post.desc[:80]

        if not title:
            title = "抖音图文"

        cover_url: HttpUrl | None = None

        for image_url in post.cover_urls:
            image_path = urlsplit(str(image_url)).path.lower()

            if image_path.endswith((".heic", ".heif")):
                continue

            cover_url = image_url

            break

        results.append(
            WebSearchResult(
                url=HttpUrl(f"https://www.douyin.com/note/{post.aweme_id}"),
                title=title,
                description=post.desc,
                cover_url=cover_url,
                author=post.author,
                published_at=post.create_time,
                likes=post.likes,
                comments=post.comments,
                collects=post.collects,
            )
        )

    if search_response.has_more and not search_response.search_id:
        raise WebSearchUnavailableError

    next_page: int | None = None

    if search_response.has_more:
        next_page = page + 1

    return WebSearchPage(
        items=results,
        next_page=next_page,
        search_id=search_response.search_id,
    )


class _NoteDetail(BaseModel):
    note_list: list[_NoteContent]


class _PostDetail(BaseModel):
    aweme_detail: _PostContent


async def content(
    url: str, source: Literal["xiaohongshu", "douyin"]
) -> tuple[str, str]:
    parsed_url = urlsplit(url)

    if source == "xiaohongshu":
        path_prefix = "/explore/"
    else:
        path_prefix = "/note/"

    item_id = parsed_url.path.removeprefix(path_prefix)

    if (
        parsed_url.hostname != f"www.{source}.com"
        or not parsed_url.path.startswith(path_prefix)
        or not item_id.isalnum()
    ):
        raise WebpageScrapeError

    try:
        if source == "xiaohongshu":
            data = await _get(
                "/api/xiaohongshu/get-note-detail/v1", {"noteId": item_id}
            )

            details = TypeAdapter(list[_NoteDetail]).validate_python(data)

            (detail,) = details
            (note,) = detail.note_list

            if note.id != item_id:
                raise WebpageScrapeError

            body = note.desc

            title = note.title

        else:
            data = await _get("/api/douyin/get-video-detail/v2", {"videoId": item_id})

            post = _PostDetail.model_validate(data).aweme_detail

            if post.aweme_id != item_id:
                raise WebpageScrapeError

            body = post.desc

            title = post.item_title

        title = " ".join(title.split())

        if not title:
            title = body.strip().split("\n", 1)[0][:80]

        if not title:
            raise WebpageScrapeError

        return body, title
    except ValueError:
        logger.warning("JustOneAPI 内容详情结构不符合预期：来源=%s", source)

        raise WebpageScrapeError from None
    except SourceConfigurationError, SourceQuotaExceededError:
        raise
    except WebSearchUnavailableError:
        raise WebpageScrapeUnavailableError from None
