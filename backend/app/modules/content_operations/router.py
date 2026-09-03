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
    category: BilibiliRankingCategoryCode = BilibiliRankingCategoryCode.ALL,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> BilibiliRankingPublic:
    """获取最近一次 B 站分区排行榜。"""
    return service.get_bilibili_ranking(
        session=session,
        category=category,
        skip=skip,
        limit=limit,
    )
