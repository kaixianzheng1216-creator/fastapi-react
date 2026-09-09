from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.api.dependencies import SessionDep
from app.api.responses import error_responses
from app.modules.auth.dependencies import get_current_active_superuser
from app.modules.auth.exceptions import CredentialsValidationError, InactiveUserError
from app.modules.influencer_marketing import service
from app.modules.influencer_marketing.constants import InfluencerPlatformCode
from app.modules.influencer_marketing.schemas import (
    InfluencerAccountPublic,
    InfluencerAccountSortBy,
    InfluencerAccountsPublic,
    InfluencerSortOrder,
)
from app.modules.users.exceptions import InsufficientPrivilegesError

router = APIRouter(
    prefix="/admin/influencer-marketing",
    tags=["influencer-marketing"],
    dependencies=[Depends(get_current_active_superuser)],
    responses=error_responses(
        CredentialsValidationError,
        InactiveUserError,
        InsufficientPrivilegesError,
    ),
)


@router.get("/accounts", response_model=InfluencerAccountsPublic)
def read_influencer_accounts(
    session: SessionDep,
    platform: Annotated[
        InfluencerPlatformCode,
        Query(
            description=(
                "达人所属平台。可选值：douyin=抖音，xiaohongshu=小红书；默认值：douyin"
            )
        ),
    ] = InfluencerPlatformCode.DOUYIN,
    skip: Annotated[int, Query(ge=0, description="跳过的记录数")] = 0,
    limit: Annotated[int, Query(ge=1, le=100, description="返回的最大记录数")] = 20,
    search: Annotated[
        str | None,
        Query(max_length=255, description="按达人名称或账号搜索"),
    ] = None,
    sort_by: Annotated[
        InfluencerAccountSortBy,
        Query(
            description=(
                "排序字段。可选值：followers=粉丝数，engagement_count=互动数；"
                "默认值：followers"
            )
        ),
    ] = InfluencerAccountSortBy.FOLLOWERS,
    sort_order: Annotated[
        InfluencerSortOrder,
        Query(description="排序方向。可选值：asc=升序，desc=降序；默认值：desc"),
    ] = InfluencerSortOrder.DESC,
) -> InfluencerAccountsPublic:
    """查询指定平台的达人资源。"""
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
