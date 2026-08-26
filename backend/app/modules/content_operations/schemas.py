from datetime import datetime

from sqlmodel import SQLModel

from app.modules.content_operations.constants import BilibiliRankingCategoryCode


class BilibiliRankingCategoryPublic(SQLModel):
    code: BilibiliRankingCategoryCode
    name: str


class BilibiliRankingItemPublic(SQLModel):
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


class BilibiliRankingPublic(SQLModel):
    captured_at: datetime | None
    categories: list[BilibiliRankingCategoryPublic]
    data: list[BilibiliRankingItemPublic]
    count: int
