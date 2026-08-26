from sqlalchemy import text
from sqlmodel import Session

from app.modules.brand_marketing.models import RegionalIndicatorCode
from app.modules.brand_marketing.schemas import (
    ProvinceAnnualDataPublic,
    RegionalDataPublic,
    RegionalSortOrder,
)


def get_regional_data(
    *,
    session: Session,
    year: int | None,
    skip: int,
    limit: int,
    sort_by: RegionalIndicatorCode,
    sort_order: RegionalSortOrder,
) -> RegionalDataPublic:
    """获取指定年份已排序、分页的分省指标。"""
    connection = session.connection()

    year_values = connection.execute(
        text(
            """
            SELECT DISTINCT year
            FROM dwd_province_annual_indicator
            ORDER BY year DESC
            """
        )
    ).scalars()

    years: list[int] = []

    for value in year_values:
        years.append(int(value))

    if not years:
        raise RuntimeError("区域数据尚未初始化")

    selected_year = year if year is not None else years[0]

    rows = connection.execute(
        text(
            f"""
            SELECT
                province_code,
                province_name,
                MAX(value) FILTER (
                    WHERE indicator_code = :resident_population
                ) AS resident_population,
                MAX(value) FILTER (
                    WHERE indicator_code = :disposable_income
                ) AS disposable_income,
                MAX(value) FILTER (
                    WHERE indicator_code = :consumption_expenditure
                ) AS consumption_expenditure,
                COUNT(*) OVER () AS total_count
            FROM dwd_province_annual_indicator
            WHERE year = :year
            GROUP BY province_code, province_name
            ORDER BY {sort_by.value} {sort_order.value}, province_code
            LIMIT :limit OFFSET :skip
            """
        ),
        {
            "year": selected_year,
            "limit": limit,
            "skip": skip,
            "resident_population": RegionalIndicatorCode.RESIDENT_POPULATION.value,
            "disposable_income": RegionalIndicatorCode.DISPOSABLE_INCOME.value,
            "consumption_expenditure": RegionalIndicatorCode.CONSUMPTION_EXPENDITURE.value,
        },
    ).mappings().all()

    data: list[ProvinceAnnualDataPublic] = []

    for row in rows:
        data.append(ProvinceAnnualDataPublic.model_validate(row))

    count = int(rows[0]["total_count"]) if rows else 0

    return RegionalDataPublic(
        year=selected_year,
        years=years,
        data=data,
        count=count,
        source="国家统计局",
    )
