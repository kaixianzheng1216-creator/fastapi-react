from sqlmodel import Session, col, func, select

from app.modules.content_operations.constants import (
    BILIBILI_RANKING_CATEGORIES,
    BilibiliRankingCategoryCode,
)
from app.modules.content_operations.models import (
    BilibiliRankingItem,
    BilibiliRankingSnapshot,
)
from app.modules.content_operations.schemas import (
    BilibiliRankingCategoryPublic,
    BilibiliRankingItemPublic,
    BilibiliRankingPublic,
)


def get_bilibili_ranking(
    *,
    session: Session,
    category: BilibiliRankingCategoryCode,
    skip: int,
    limit: int,
) -> BilibiliRankingPublic:
    categories: list[BilibiliRankingCategoryPublic] = []

    for item in BILIBILI_RANKING_CATEGORIES:
        categories.append(BilibiliRankingCategoryPublic(code=item.code, name=item.name))

    snapshot = session.exec(
        select(BilibiliRankingSnapshot)
        .order_by(col(BilibiliRankingSnapshot.captured_at).desc())
        .limit(1)
    ).first()

    if snapshot is None:
        return BilibiliRankingPublic(
            captured_at=None,
            categories=categories,
            data=[],
            count=0,
        )

    conditions = [
        BilibiliRankingItem.snapshot_id == snapshot.id,
        BilibiliRankingItem.ranking_category_code == category.value,
    ]

    rows = session.exec(
        select(BilibiliRankingItem)
        .where(*conditions)
        .order_by(col(BilibiliRankingItem.rank))
        .offset(skip)
        .limit(limit)
    ).all()

    count = session.exec(
        select(func.count()).select_from(BilibiliRankingItem).where(*conditions)
    ).one()

    data: list[BilibiliRankingItemPublic] = []

    for row in rows:
        data.append(BilibiliRankingItemPublic.model_validate(row))

    return BilibiliRankingPublic(
        captured_at=snapshot.captured_at,
        categories=categories,
        data=data,
        count=count,
    )
