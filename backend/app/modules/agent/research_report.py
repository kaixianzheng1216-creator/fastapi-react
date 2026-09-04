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

    card_count = 0
    previous_end = 0

    for match in REPORT_BLOCK_PATTERN.finditer(report):
        block_type, content = match.groups()

        if card_count and (
            block_type != "card" or report[previous_end : match.start()].strip()
        ):
            if card_count not in (2, 3, 4):
                raise ValueError("每组文本卡片必须包含 2 至 4 张")

            card_count = 0

        if block_type == "chart":
            ResearchChart.model_validate_json(content, strict=True)
        else:
            ResearchCard.model_validate_json(content, strict=True)
            card_count += 1

        previous_end = match.end()

    if card_count not in (0, 2, 3, 4):
        raise ValueError("每组文本卡片必须包含 2 至 4 张")


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
