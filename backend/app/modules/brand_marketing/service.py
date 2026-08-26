from decimal import Decimal

from sqlalchemy import text
from sqlmodel import Session

from app.modules.brand_marketing.importer import import_regional_data
from app.modules.brand_marketing.models import RegionalIndicatorCode
from app.modules.brand_marketing.schemas import (
    ProvinceAnnualDataPublic,
    RegionalDataPublic,
    RegionalSortOrder,
)


def refresh_regional_data(*, session: Session) -> None:
    """重新导入国家统计局分省年度数据。"""
    import_regional_data(session)


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
    previous_year = selected_year - 1

    rows = (
        connection.execute(
            text(
                f"""
            WITH indicator_values AS (
                SELECT
                    province_code,
                    province_name,
                    indicator_code,
                    year,
                    value,
                    LAG(value) OVER (
                        PARTITION BY province_code, indicator_code
                        ORDER BY year
                    ) AS previous_value
                FROM dwd_province_annual_indicator
                WHERE year IN (:year, :previous_year)
            )
            SELECT
                province_code,
                province_name,
                MAX(value) FILTER (
                    WHERE indicator_code = :resident_population
                ) AS resident_population,
                MAX(previous_value) FILTER (
                    WHERE indicator_code = :resident_population
                ) AS previous_resident_population,
                MAX(value) FILTER (
                    WHERE indicator_code = :disposable_income
                ) AS disposable_income,
                MAX(previous_value) FILTER (
                    WHERE indicator_code = :disposable_income
                ) AS previous_disposable_income,
                MAX(value) FILTER (
                    WHERE indicator_code = :consumption_expenditure
                ) AS consumption_expenditure,
                MAX(previous_value) FILTER (
                    WHERE indicator_code = :consumption_expenditure
                ) AS previous_consumption_expenditure,
                MAX(value) FILTER (
                    WHERE indicator_code = :retail_sales
                ) AS retail_sales,
                MAX(previous_value) FILTER (
                    WHERE indicator_code = :retail_sales
                ) AS previous_retail_sales,
                COUNT(*) OVER () AS total_count
            FROM indicator_values
            WHERE year = :year
            GROUP BY province_code, province_name
            ORDER BY {sort_by.value} {sort_order.value}, province_code
            LIMIT :limit OFFSET :skip
            """
            ),
            {
                "year": selected_year,
                "previous_year": previous_year,
                "limit": limit,
                "skip": skip,
                "resident_population": RegionalIndicatorCode.RESIDENT_POPULATION.value,
                "disposable_income": RegionalIndicatorCode.DISPOSABLE_INCOME.value,
                "consumption_expenditure": RegionalIndicatorCode.CONSUMPTION_EXPENDITURE.value,
                "retail_sales": RegionalIndicatorCode.RETAIL_SALES.value,
            },
        )
        .mappings()
        .all()
    )

    data: list[ProvinceAnnualDataPublic] = []

    for row in rows:
        data.append(
            ProvinceAnnualDataPublic(
                province_code=str(row["province_code"]),
                province_name=str(row["province_name"]),
                resident_population=float(row["resident_population"]),
                resident_population_yoy=_calculate_yoy(
                    row["resident_population"],
                    row["previous_resident_population"],
                ),
                disposable_income=float(row["disposable_income"]),
                disposable_income_yoy=_calculate_yoy(
                    row["disposable_income"],
                    row["previous_disposable_income"],
                ),
                consumption_expenditure=float(row["consumption_expenditure"]),
                consumption_expenditure_yoy=_calculate_yoy(
                    row["consumption_expenditure"],
                    row["previous_consumption_expenditure"],
                ),
                retail_sales=float(row["retail_sales"]),
                retail_sales_yoy=_calculate_yoy(
                    row["retail_sales"],
                    row["previous_retail_sales"],
                ),
            )
        )

    count = int(rows[0]["total_count"]) if rows else 0

    return RegionalDataPublic(
        year=selected_year,
        years=years,
        data=data,
        count=count,
        source="国家统计局",
    )


def _calculate_yoy(value: Decimal, previous_value: Decimal | None) -> float | None:
    if previous_value is None or previous_value == 0:
        return None

    return float((value - previous_value) / previous_value)
