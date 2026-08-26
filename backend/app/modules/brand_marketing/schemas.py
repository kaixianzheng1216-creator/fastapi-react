from enum import StrEnum

from sqlmodel import SQLModel


class RegionalSortOrder(StrEnum):
    ASC = "asc"
    DESC = "desc"


class ProvinceAnnualDataPublic(SQLModel):
    province_code: str
    province_name: str
    resident_population: float
    disposable_income: float
    consumption_expenditure: float
    retail_sales: float


class RegionalDataPublic(SQLModel):
    year: int
    years: list[int]
    data: list[ProvinceAnnualDataPublic]
    count: int
    source: str
