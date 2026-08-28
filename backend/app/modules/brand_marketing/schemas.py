from enum import StrEnum

from sqlmodel import SQLModel

from app.modules.brand_marketing.constants import RegionalIndicatorCode


class RegionalSortOrder(StrEnum):
    ASC = "asc"
    DESC = "desc"


class RegionalIndicatorPublic(SQLModel):
    code: RegionalIndicatorCode
    name: str
    unit: str


class ProvinceAnnualDataPublic(SQLModel):
    province_code: str
    province_name: str
    resident_population: float
    resident_population_yoy: float | None
    urbanization_rate: float | None
    urbanization_rate_yoy: float | None
    disposable_income: float
    disposable_income_yoy: float | None
    consumption_expenditure: float
    consumption_expenditure_yoy: float | None
    retail_sales: float
    retail_sales_yoy: float | None


class RegionalDataPublic(SQLModel):
    year: int | None
    years: list[int]
    indicators: list[RegionalIndicatorPublic]
    data: list[ProvinceAnnualDataPublic]
    count: int
    source: str
