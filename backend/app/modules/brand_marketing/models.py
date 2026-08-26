from decimal import Decimal
from enum import StrEnum

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


class RegionalIndicatorCode(StrEnum):
    RESIDENT_POPULATION = "resident_population"
    DISPOSABLE_INCOME = "disposable_income"
    CONSUMPTION_EXPENDITURE = "consumption_expenditure"
    RETAIL_SALES = "retail_sales"


class ProvinceAnnualIndicator(SQLModel, table=True):
    __tablename__ = "dwd_province_annual_indicator"
    __table_args__ = (
        UniqueConstraint(
            "indicator_code",
            "province_code",
            "year",
            name="uq_province_annual_indicator_key",
        ),
    )

    id: int | None = Field(default=None, primary_key=True)
    indicator_code: str = Field(max_length=50)
    province_code: str = Field(max_length=6)
    province_name: str = Field(max_length=50)
    year: int
    value: Decimal = Field(max_digits=20, decimal_places=4)
