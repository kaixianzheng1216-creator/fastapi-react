import re
from typing import Annotated, Literal, Self

from pydantic import (
    BaseModel,
    Field,
    FiniteFloat,
    StringConstraints,
    model_validator,
)

NonEmptyString = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1),
]

REPORT_BLOCK_PATTERN = re.compile(r"```(chart|card)\s*(.*?)```", re.DOTALL)


def validate_research_report(report: str) -> None:
    if not report.strip():
        raise ValueError("最终报告为空")

    for match in REPORT_BLOCK_PATTERN.finditer(report):
        block_type, content = match.groups()

        if block_type == "chart":
            ResearchChart.model_validate_json(content, strict=True)
        else:
            ResearchCard.model_validate_json(content, strict=True)


class ResearchChartSeries(BaseModel):
    name: NonEmptyString
    data: list[FiniteFloat] = Field(min_length=1)


class ResearchChart(BaseModel):
    type: Literal["line", "bar", "area", "pie"]
    title: NonEmptyString
    unit: str | None = None
    categories: list[NonEmptyString] = Field(min_length=1)
    series: list[ResearchChartSeries] = Field(min_length=1)
    source: str | None = None

    @model_validator(mode="after")
    def validate_dimensions(self) -> Self:
        for series in self.series:
            if len(series.data) != len(self.categories):
                raise ValueError("图表序列与分类数量不一致")

        if self.type == "pie":
            if len(self.series) != 1:
                raise ValueError("饼图只允许一个数据序列")

            total = 0.0

            for value in self.series[0].data:
                if value < 0:
                    raise ValueError("饼图数据不能为负数")

                total += value

            if total <= 0:
                raise ValueError("饼图数据之和必须大于零")

        return self


class ResearchCard(BaseModel):
    title: NonEmptyString
    content: NonEmptyString
