from dataclasses import dataclass
from enum import StrEnum


class RegionalIndicatorCode(StrEnum):
    RESIDENT_POPULATION = "resident_population"
    URBANIZATION_RATE = "urbanization_rate"
    PER_CAPITA_GDP = "per_capita_gdp"
    DISPOSABLE_INCOME = "disposable_income"
    CONSUMPTION_EXPENDITURE = "consumption_expenditure"
    RETAIL_SALES = "retail_sales"


URBAN_POPULATION_INDICATOR_CODE = "urban_population"


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
        RegionalIndicatorCode.URBANIZATION_RATE,
        "城镇化率",
        "%",
    ),
    RegionalIndicator(
        RegionalIndicatorCode.PER_CAPITA_GDP,
        "人均地区生产总值",
        "元/人",
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
