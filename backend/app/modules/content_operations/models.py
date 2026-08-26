from datetime import datetime

from sqlalchemy import BigInteger, DateTime, UniqueConstraint
from sqlmodel import Field, SQLModel

from app.db.timestamps import utc_now


class BilibiliRankingSnapshot(SQLModel, table=True):
    __tablename__ = "bilibili_ranking_snapshot"

    id: int | None = Field(default=None, primary_key=True)
    captured_at: datetime = Field(
        default_factory=utc_now,
        index=True,
        sa_type=DateTime(timezone=True),  # type: ignore
    )


class BilibiliRankingItem(SQLModel, table=True):
    __tablename__ = "bilibili_ranking_item"
    __table_args__ = (
        UniqueConstraint(
            "snapshot_id",
            "ranking_category_code",
            "rank",
            name="uq_bilibili_ranking_item_rank",
        ),
        UniqueConstraint(
            "snapshot_id",
            "ranking_category_code",
            "bvid",
            name="uq_bilibili_ranking_item_bvid",
        ),
    )

    id: int | None = Field(default=None, primary_key=True)
    snapshot_id: int = Field(
        foreign_key="bilibili_ranking_snapshot.id",
        ondelete="CASCADE",
    )
    ranking_category_code: str = Field(max_length=20)
    rank: int
    bvid: str = Field(max_length=20)
    title: str = Field(max_length=255)
    cover_url: str = Field(max_length=500)
    duration_seconds: int
    author_name: str = Field(max_length=100)
    content_category_name: str = Field(max_length=50)
    view_count: int = Field(sa_type=BigInteger)
    danmaku_count: int = Field(sa_type=BigInteger)
    published_at: datetime = Field(sa_type=DateTime(timezone=True))  # type: ignore
