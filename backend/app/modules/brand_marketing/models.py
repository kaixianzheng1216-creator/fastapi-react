from decimal import Decimal

from sqlmodel import Field, SQLModel


class ProvinceAnnualIndicator(SQLModel, table=True):
    __tablename__ = "province_annual_indicator"

    id: int | None = Field(default=None, primary_key=True)
    indicator_code: str = Field(max_length=50)
    province_code: str = Field(max_length=6)
    province_name: str = Field(max_length=50)
    year: int
    value: Decimal = Field(max_digits=20, decimal_places=4)
