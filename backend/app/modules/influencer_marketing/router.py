from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.api.dependencies import SessionDep
from app.modules.auth.dependencies import get_current_active_superuser
from app.modules.influencer_marketing import service
from app.modules.influencer_marketing.constants import InfluencerPlatformCode
from app.modules.influencer_marketing.schemas import (
    InfluencerAccountPublic,
    InfluencerAccountSortBy,
    InfluencerAccountsPublic,
    InfluencerSortOrder,
)

router = APIRouter(
    prefix="/admin/influencer-marketing",
    tags=["influencer-marketing"],
    dependencies=[Depends(get_current_active_superuser)],
)


@router.get("/accounts", response_model=InfluencerAccountsPublic)
def read_influencer_accounts(
    session: SessionDep,
    platform: InfluencerPlatformCode = InfluencerPlatformCode.XIAOHONGSHU,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    search: Annotated[str | None, Query(max_length=255)] = None,
    sort_by: InfluencerAccountSortBy = InfluencerAccountSortBy.FOLLOWERS,
    sort_order: InfluencerSortOrder = InfluencerSortOrder.DESC,
) -> InfluencerAccountsPublic:
    """获取指定平台的达人资源。"""
    snapshot, accounts, count = service.list_influencer_accounts(
        session=session,
        platform=platform,
        skip=skip,
        limit=limit,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
    )

    data: list[InfluencerAccountPublic] = []

    for account in accounts:
        data.append(InfluencerAccountPublic.model_validate(account))

    return InfluencerAccountsPublic(
        captured_at=snapshot.captured_at if snapshot is not None else None,
        data=data,
        count=count,
    )
