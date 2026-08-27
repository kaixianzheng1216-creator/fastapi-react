from collections.abc import Sequence

from sqlalchemy import or_
from sqlalchemy.sql.elements import ColumnElement
from sqlmodel import Session, col, func, select

from app.modules.influencer_marketing.constants import InfluencerPlatformCode
from app.modules.influencer_marketing.models import (
    InfluencerAccount,
    InfluencerAccountSnapshot,
)
from app.modules.influencer_marketing.schemas import (
    InfluencerAccountSortBy,
    InfluencerSortOrder,
)


def list_influencer_accounts(
    *,
    session: Session,
    platform: InfluencerPlatformCode,
    skip: int,
    limit: int,
    search: str | None,
    sort_by: InfluencerAccountSortBy,
    sort_order: InfluencerSortOrder,
) -> tuple[InfluencerAccountSnapshot | None, Sequence[InfluencerAccount], int]:
    snapshot = session.exec(
        select(InfluencerAccountSnapshot)
        .order_by(col(InfluencerAccountSnapshot.captured_at).desc())
        .limit(1)
    ).first()

    if snapshot is None:
        return None, [], 0

    filters: list[ColumnElement[bool]] = [
        col(InfluencerAccount.snapshot_id) == snapshot.id,
        col(InfluencerAccount.platform) == platform.value,
    ]

    query = search.strip() if search else ""

    if query:
        filters.append(
            or_(
                col(InfluencerAccount.nickname).icontains(query, autoescape=True),
                col(InfluencerAccount.public_account_id).icontains(
                    query,
                    autoescape=True,
                ),
            )
        )

    count = session.exec(
        select(func.count()).select_from(InfluencerAccount).where(*filters)
    ).one()

    sort_column = (
        col(InfluencerAccount.followers)
        if sort_by == InfluencerAccountSortBy.FOLLOWERS
        else col(InfluencerAccount.engagement_count)
    )
    order_by = (
        sort_column.asc().nulls_last()
        if sort_order == InfluencerSortOrder.ASC
        else sort_column.desc().nulls_last()
    )

    accounts = session.exec(
        select(InfluencerAccount)
        .where(*filters)
        .order_by(
            order_by,
            col(InfluencerAccount.id),
        )
        .offset(skip)
        .limit(limit)
    ).all()

    return snapshot, accounts, count
