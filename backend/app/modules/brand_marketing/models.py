from decimal import Decimal

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


class ProvinceAnnualIndicator(SQLModel, table=True):
    __tablename__ = "province_annual_indicator"
    __table_args__ = (
        UniqueConstraint(
            "province_code",
            "year",
            "indicator_code",
            name="uq_province_annual_indicator_dimension",
        ),
    )

    id: int | None = Field(default=None, primary_key=True)
    province_code: str = Field(max_length=6)
    province_name: str = Field(max_length=50)
    year: int
    indicator_code: str = Field(max_length=50)
    value: Decimal = Field(max_digits=20, decimal_places=4)
