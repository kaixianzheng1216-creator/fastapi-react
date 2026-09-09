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
    year: Annotated[
        int | None,
        Query(ge=1900, le=2100, description="统计年份；不传则使用最新年份"),
    ] = None,
    skip: Annotated[int, Query(ge=0, description="跳过的记录数")] = 0,
    limit: Annotated[int, Query(ge=1, le=100, description="返回的最大记录数")] = 20,
    sort_by: Annotated[
        RegionalIndicatorCode,
        Query(
            description=(
                "排序指标。可选值：resident_population=年末常住人口，"
                "urbanization_rate=城镇化率，per_capita_gdp=人均地区生产总值，"
                "disposable_income=人均可支配收入，"
                "consumption_expenditure=人均消费支出，"
                "retail_sales=社会消费品零售总额；默认值：resident_population"
            )
        ),
    ] = RegionalIndicatorCode.RESIDENT_POPULATION,
    sort_order: Annotated[
        RegionalSortOrder,
        Query(description="排序方向。可选值：asc=升序，desc=降序；默认值：desc"),
    ] = RegionalSortOrder.DESC,
) -> RegionalDataPublic:
    """查询品牌营销区域数据。"""
    return service.get_regional_data(
        session=session,
        year=year,
        skip=skip,
        limit=limit,
        sort_by=sort_by,
        sort_order=sort_order,
    )
