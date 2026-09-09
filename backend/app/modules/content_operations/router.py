from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.api.dependencies import SessionDep
from app.api.responses import error_responses
from app.modules.auth.dependencies import get_current_active_superuser
from app.modules.auth.exceptions import CredentialsValidationError, InactiveUserError
from app.modules.content_operations import service
from app.modules.content_operations.constants import BilibiliRankingCategoryCode
from app.modules.content_operations.schemas import BilibiliRankingPublic
from app.modules.users.exceptions import InsufficientPrivilegesError

router = APIRouter(
    prefix="/admin/content-operations",
    tags=["content-operations"],
    dependencies=[Depends(get_current_active_superuser)],
    responses=error_responses(
        CredentialsValidationError,
        InactiveUserError,
        InsufficientPrivilegesError,
    ),
)


@router.get("/rankings/bilibili", response_model=BilibiliRankingPublic)
def read_bilibili_ranking(
    session: SessionDep,
    category: Annotated[
        BilibiliRankingCategoryCode,
        Query(
            description=(
                "B 站排行榜分区。可选值：all=全部，animation=动画，game=游戏，"
                "kichiku=鬼畜，music=音乐，dance=舞蹈，cinephile=影视，"
                "entertainment=娱乐，knowledge=知识，tech=科技数码，food=美食，"
                "car=汽车，fashion=时尚美妆，sports=体育运动；默认值：all"
            )
        ),
    ] = BilibiliRankingCategoryCode.ALL,
    skip: Annotated[int, Query(ge=0, description="跳过的记录数")] = 0,
    limit: Annotated[int, Query(ge=1, le=100, description="返回的最大记录数")] = 20,
) -> BilibiliRankingPublic:
    """查询最近一次 B 站分区排行榜。"""
    return service.get_bilibili_ranking(
        session=session,
        category=category,
        skip=skip,
        limit=limit,
    )
