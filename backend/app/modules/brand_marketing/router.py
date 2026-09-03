from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.api.dependencies import SessionDep
from app.api.responses import error_responses
from app.modules.auth.dependencies import get_current_active_superuser
from app.modules.auth.exceptions import CredentialsValidationError, InactiveUserError
from app.modules.brand_marketing import service
from app.modules.brand_marketing.constants import RegionalIndicatorCode
from app.modules.brand_marketing.schemas import (
    RegionalDataPublic,
    RegionalSortOrder,
)
from app.modules.users.exceptions import InsufficientPrivilegesError

router = APIRouter(
    prefix="/admin/brand-marketing",
    tags=["brand-marketing"],
    dependencies=[Depends(get_current_active_superuser)],
    responses=error_responses(
        CredentialsValidationError,
        InactiveUserError,
        InsufficientPrivilegesError,
    ),
)


@router.get("/regional-data", response_model=RegionalDataPublic)
def read_regional_data(
    session: SessionDep,
    year: Annotated[int | None, Query(ge=1900, le=2100)] = None,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    sort_by: RegionalIndicatorCode = RegionalIndicatorCode.RESIDENT_POPULATION,
    sort_order: RegionalSortOrder = RegionalSortOrder.DESC,
) -> RegionalDataPublic:
    """获取品牌营销区域数据。"""
    return service.get_regional_data(
        session=session,
        year=year,
        skip=skip,
        limit=limit,
        sort_by=sort_by,
        sort_order=sort_order,
    )
