"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { z } from "zod";

const chartSchema = z.object({
  type: z.enum(["line", "bar", "area", "pie"]),
  title: z.string().trim().min(1),
  unit: z.string().trim().optional(),
  categories: z.array(z.string().trim().min(1)).min(1),
  series: z.array(
    z.object({
      name: z.string().trim().min(1),
      data: z.array(z.number().finite()).min(1),
    }),
  ).min(1),
  source: z.string().trim().optional(),
})
  .refine(
    ({ categories, series }) =>
      series.every(({ data }) => data.length === categories.length),
    "图表序列与分类数量不一致",
  )
  .refine(
    ({ type, series }) => type !== "pie" || series.length === 1,
    "环形图只允许一个数据序列",
  )
  .refine(
    ({ type, series }) =>
      type !== "pie" ||
      (series[0]?.data.every((value) => value >= 0) ?? false),
    "环形图数据不能为负数",
  )
  .refine(
    ({ type, series }) =>
      type !== "pie" ||
      (series[0]?.data.reduce((sum, value) => sum + value, 0) ?? 0) > 0,
    "环形图数据之和必须大于零",
  );

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function externalUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

export function ResearchChart({ value }: { value: string }) {
  let input: unknown;

  try {
    input = JSON.parse(value) as unknown;
  } catch {
    return <InvalidChart />;
  }

  const result = chartSchema.safeParse(input);

  if (!result.success) {
    return <InvalidChart />;
  }

  const chart = result.data;
  const sourceUrl = chart.source ? externalUrl(chart.source) : undefined;
  const series = chart.series.map((item, index) => ({
    ...item,
    key: `series_${index}`,
  }));
  const data = chart.categories.map((category, index) => ({
    category,
    ...Object.fromEntries(
      series.map((item) => [item.key, item.data[index]]),
    ),
  }));
  const pieData = chart.categories.map((_, index) => ({
    categoryKey: `category_${index}`,
    value: chart.series[0].data[index],
    fill: `var(--color-category_${index})`,
  }));
  const config: ChartConfig =
    chart.type === "pie"
      ? Object.fromEntries(
          chart.categories.map((label, index) => [
            `category_${index}`,
            { label, color: COLORS[index % COLORS.length] },
          ]),
        )
      : Object.fromEntries(
          series.map((item, index) => [
            item.key,
            { label: item.name, color: COLORS[index % COLORS.length] },
          ]),
        );
  const Chart =
    chart.type === "line"
      ? LineChart
      : chart.type === "area"
        ? AreaChart
        : BarChart;

  return (
    <figure data-report-chart className="my-8 flex flex-col gap-4">
      <div className="flex flex-col gap-1 text-center">
        <h3 className="font-semibold">{chart.title}</h3>
        {chart.unit && (
          <p className="text-muted-foreground text-sm">单位：{chart.unit}</p>
        )}
      </div>
      <ChartContainer
        aria-hidden="true"
        config={config}
        className="h-80 aspect-auto"
      >
        {chart.type === "pie" ? (
          <PieChart>
            <ChartTooltip
              content={
                <ChartTooltipContent nameKey="categoryKey" hideLabel />
              }
            />
            <ChartLegend
              content={
                <ChartLegendContent
                  nameKey="categoryKey"
                  className="flex-wrap"
                />
              }
            />
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="categoryKey"
              innerRadius="45%"
              outerRadius="75%"
              isAnimationActive={false}
            />
          </PieChart>
        ) : (
          <Chart
            data={data}
            margin={{ top: 16, right: 16, left: 8, bottom: 8 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis dataKey="category" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend
              content={<ChartLegendContent className="flex-wrap" />}
            />
            {series.map((item) => {
              const color = `var(--color-${item.key})`;

              if (chart.type === "line") {
                return (
                  <Line
                    key={item.key}
                    type="monotone"
                    dataKey={item.key}
                    stroke={color}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    isAnimationActive={false}
                  />
                );
              }

              if (chart.type === "area") {
                return (
                  <Area
                    key={item.key}
                    type="monotone"
                    dataKey={item.key}
                    stroke={color}
                    fill={color}
                    fillOpacity={0.2}
                    isAnimationActive={false}
                  />
                );
              }

              return (
                <Bar
                  key={item.key}
                  dataKey={item.key}
                  fill={color}
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
              );
            })}
          </Chart>
        )}
      </ChartContainer>
      <table className="sr-only">
        <caption>{chart.title}</caption>
        <thead>
          <tr>
            <th scope="col">分类</th>
            {chart.series.map((item) => (
              <th key={item.name} scope="col">
                {item.name}
                {chart.unit ? `（${chart.unit}）` : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {chart.categories.map((category, categoryIndex) => (
            <tr key={category}>
              <th scope="row">{category}</th>
              {chart.series.map((item) => (
                <td key={item.name}>{item.data[categoryIndex]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {chart.source && (
        <figcaption className="text-muted-foreground text-right text-xs">
          数据来源：
          {sourceUrl ? (
            <a href={sourceUrl} target="_blank" rel="noreferrer">
              {chart.source}
            </a>
          ) : (
            chart.source
          )}
        </figcaption>
      )}
    </figure>
  );
}

function InvalidChart() {
  return (
    <Alert
      data-report-block-error
      data-report-chart-error
      className="my-8"
      variant="destructive"
    >
      <AlertDescription>图表数据格式无效</AlertDescription>
    </Alert>
  );
}
