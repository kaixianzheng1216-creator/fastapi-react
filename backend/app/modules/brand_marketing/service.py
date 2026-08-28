from decimal import Decimal

from sqlalchemy import text
from sqlmodel import Session

from app.modules.brand_marketing.constants import (
    REGIONAL_INDICATORS,
    URBAN_POPULATION_INDICATOR_CODE,
    RegionalIndicatorCode,
)
from app.modules.brand_marketing.schemas import (
    ProvinceAnnualDataPublic,
    RegionalDataPublic,
    RegionalIndicatorPublic,
    RegionalSortOrder,
)

REGIONAL_DATA_SOURCE = "国家统计局"


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
            FROM province_annual_indicator
            ORDER BY year DESC
            """
        )
    ).scalars()
    years: list[int] = []

    for value in year_values:
        years.append(int(value))

    indicators: list[RegionalIndicatorPublic] = []

    for indicator in REGIONAL_INDICATORS:
        indicators.append(
            RegionalIndicatorPublic(
                code=indicator.code,
                name=indicator.name,
                unit=indicator.unit,
            )
        )

    if not years:
        return RegionalDataPublic(
            year=year,
            years=[],
            indicators=indicators,
            data=[],
            count=0,
            source=REGIONAL_DATA_SOURCE,
        )

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
                FROM province_annual_indicator
                WHERE year IN (:year, :previous_year)
            ), province_values AS (
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
                    WHERE indicator_code = :urban_population
                ) AS urban_population,
                MAX(previous_value) FILTER (
                    WHERE indicator_code = :urban_population
                ) AS previous_urban_population,
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
                ) AS previous_retail_sales
            FROM indicator_values
            WHERE year = :year
            GROUP BY province_code, province_name
            )
            SELECT
                *,
                CASE
                    WHEN resident_population > 0 AND urban_population IS NOT NULL
                    THEN urban_population / resident_population
                END AS urbanization_rate,
                CASE
                    WHEN previous_resident_population > 0
                        AND previous_urban_population IS NOT NULL
                    THEN previous_urban_population / previous_resident_population
                END AS previous_urbanization_rate,
                COUNT(*) OVER () AS total_count
            FROM province_values
            ORDER BY {sort_by.value} {sort_order.value} NULLS LAST, province_code
            LIMIT :limit OFFSET :skip
            """
            ),
            {
                "year": selected_year,
                "previous_year": previous_year,
                "limit": limit,
                "skip": skip,
                "resident_population": RegionalIndicatorCode.RESIDENT_POPULATION.value,
                "urban_population": URBAN_POPULATION_INDICATOR_CODE,
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
                urbanization_rate=_to_float(row["urbanization_rate"]),
                urbanization_rate_yoy=_calculate_difference(
                    row["urbanization_rate"],
                    row["previous_urbanization_rate"],
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
        indicators=indicators,
        data=data,
        count=count,
        source=REGIONAL_DATA_SOURCE,
    )


def _calculate_yoy(value: Decimal, previous_value: Decimal | None) -> float | None:
    if previous_value is None or previous_value == 0:
        return None

    return float((value - previous_value) / previous_value)


def _calculate_difference(
    value: Decimal | None,
    previous_value: Decimal | None,
) -> float | None:
    if value is None or previous_value is None:
        return None

    return float(value - previous_value)


def _to_float(value: Decimal | None) -> float | None:
    return None if value is None else float(value)
