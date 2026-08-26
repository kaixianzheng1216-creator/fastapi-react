from dataclasses import dataclass
from enum import StrEnum


class RegionalIndicatorCode(StrEnum):
    RESIDENT_POPULATION = "resident_population"
    DISPOSABLE_INCOME = "disposable_income"
    CONSUMPTION_EXPENDITURE = "consumption_expenditure"
    RETAIL_SALES = "retail_sales"


@dataclass(frozen=True, slots=True)
class RegionalIndicator:
    code: RegionalIndicatorCode
    name: str
    unit: str


REGIONAL_INDICATORS = (
    RegionalIndicator(
        RegionalIndicatorCode.RESIDENT_POPULATION,
        "年末常住人口",
        "万人",
    ),
    RegionalIndicator(
        RegionalIndicatorCode.DISPOSABLE_INCOME,
        "全体居民人均可支配收入",
        "元",
    ),
    RegionalIndicator(
        RegionalIndicatorCode.CONSUMPTION_EXPENDITURE,
        "全体居民人均消费支出",
        "元",
    ),
    RegionalIndicator(
        RegionalIndicatorCode.RETAIL_SALES,
        "社会消费品零售总额",
        "亿元",
    ),
)
