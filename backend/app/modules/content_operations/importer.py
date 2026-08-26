from sqlalchemy import delete
from sqlmodel import Session, col

from app.modules.content_operations.bilibili import fetch_bilibili_rankings
from app.modules.content_operations.models import (
    BilibiliRankingItem,
    BilibiliRankingSnapshot,
)


def import_bilibili_rankings(*, session: Session) -> None:
    """导入最近一次 B 站分区排行榜。"""
    entries = fetch_bilibili_rankings()

    snapshot = BilibiliRankingSnapshot()
    session.add(snapshot)
    session.flush()

    if snapshot.id is None:
        raise RuntimeError("B 站榜单快照保存失败")

    items: list[BilibiliRankingItem] = []

    for entry in entries:
        items.append(
            BilibiliRankingItem(
                snapshot_id=snapshot.id,
                ranking_category_code=entry.ranking_category_code.value,
                rank=entry.rank,
                bvid=entry.bvid,
                title=entry.title,
                cover_url=entry.cover_url,
                duration_seconds=entry.duration_seconds,
                author_name=entry.author_name,
                content_category_name=entry.content_category_name,
                view_count=entry.view_count,
                danmaku_count=entry.danmaku_count,
                published_at=entry.published_at,
            )
        )

    session.add_all(items)

    session.flush()

    session.exec(
        delete(BilibiliRankingSnapshot).where(
            col(BilibiliRankingSnapshot.id) != snapshot.id
        )
    )

    session.commit()
