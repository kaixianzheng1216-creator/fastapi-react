from enum import StrEnum

from sqlmodel import SQLModel


class RegionalSortOrder(StrEnum):
    ASC = "asc"
    DESC = "desc"


class ProvinceAnnualDataPublic(SQLModel):
    province_code: str
    province_name: str
    resident_population: float
    resident_population_yoy: float | None
    disposable_income: float
    disposable_income_yoy: float | None
    consumption_expenditure: float
    consumption_expenditure_yoy: float | None
    retail_sales: float
    retail_sales_yoy: float | None


class RegionalDataPublic(SQLModel):
    year: int
    years: list[int]
    data: list[ProvinceAnnualDataPublic]
    count: int
    source: str
