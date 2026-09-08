"use client";

import { useAuiState } from "@assistant-ui/react";
import { useMutation } from "@tanstack/react-query";
import { MarkdownContent } from "@/components/shared/markdown-content";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Spinner } from "@/components/ui/spinner";
import { getApiErrorMessage } from "@/lib/api-error";
import { agentDownloadConversationReportPdf } from "@/lib/client";
import { cn } from "@/lib/utils";
import { DownloadIcon } from "lucide-react";
import { memo } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";

type ChartData = {
  type: "line" | "bar" | "area" | "pie";
  title: string;
  unit?: string | null;
  categories: string[];
  series: Array<{ name: string; data: number[] }>;
  source?: string | null;
};

type ReportBlock =
  | { type: "markdown"; content: string }
  | { type: "chart"; content: string }
  | { type: "cards"; cards: string[] };

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function ResearchReport({ report }: { report: string }) {
  const conversationId = useAuiState((state) => state.threadListItem.remoteId)!;

  const pdfDownload = useMutation({
    mutationFn: async () => {
      const { data: pdfBlob } = await agentDownloadConversationReportPdf({
        path: { conversation_id: conversationId },
        parseAs: "blob",
        throwOnError: true,
      });

      const downloadUrl = URL.createObjectURL(pdfBlob);
      const pdfFilename = getReportTitle(report)
        .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
        .trim();

      const downloadLink = document.createElement("a");

      downloadLink.href = downloadUrl;
      downloadLink.download = `${pdfFilename || "调研报告"}.pdf`;
      downloadLink.click();

      setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
    },
  });

  return (
    <article className="mt-8">
      <Card>
        <CardHeader>
          <CardAction>
            <Button
              variant="outline"
              size="sm"
              disabled={pdfDownload.isPending}
              aria-busy={pdfDownload.isPending}
              onClick={() => pdfDownload.mutate()}
            >
              {pdfDownload.isPending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <DownloadIcon data-icon="inline-start" aria-hidden="true" />
              )}
              {pdfDownload.isPending ? "正在下载…" : "下载 PDF"}
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent className="flex flex-col gap-6">
          {pdfDownload.error && (
            <Alert variant="destructive">
              <AlertDescription>
                {getApiErrorMessage(
                  pdfDownload.error,
                  "PDF 导出失败，请重试。",
                )}
              </AlertDescription>
            </Alert>
          )}

          <ResearchReportContent report={report} />
        </CardContent>
      </Card>
    </article>
  );
}

export const ResearchReportContent = memo(function ResearchReportContent({
  report,
}: {
  report: string;
}) {
  return splitReport(report).map((block, index) => {
    if (block.type === "chart") {
      return <ResearchChart key={index} chartJson={block.content} />;
    }

    if (block.type === "cards") {
      return <ResearchCards key={index} cards={block.cards} />;
    }

    return (
      <MarkdownContent key={index} className="max-w-none">
        {block.content}
      </MarkdownContent>
    );
  });
});

function splitReport(report: string): ReportBlock[] {
  const blocks: ReportBlock[] = [];
  const blockPattern = /```(chart|card)\s*([\s\S]*?)```/g;
  let contentStart = 0;

  for (const blockMatch of report.matchAll(blockPattern)) {
    const [, blockType, blockContent] = blockMatch;
    const markdown = report.slice(contentStart, blockMatch.index);

    if (markdown.trim()) {
      blocks.push({ type: "markdown", content: markdown });
    }

    if (blockType === "chart") {
      blocks.push({ type: "chart", content: blockContent });
    } else {
      const previousBlock = blocks.at(-1);

      if (previousBlock?.type === "cards") {
        previousBlock.cards.push(blockContent);
      } else {
        blocks.push({ type: "cards", cards: [blockContent] });
      }
    }

    contentStart = blockMatch.index + blockMatch[0].length;
  }

  if (contentStart < report.length) {
    blocks.push({ type: "markdown", content: report.slice(contentStart) });
  }

  return blocks;
}

function ResearchCards({ cards }: { cards: string[] }) {
  return (
    <div
      className={cn(
        "my-8 grid gap-4",
        cards.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2",
      )}
    >
      {cards.map((cardJson, index) => {
        const card = JSON.parse(cardJson) as {
          title: string;
          content: string;
        };

        return (
          <Card key={index}>
            <CardHeader>
              <CardTitle>{card.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <MarkdownContent>{card.content}</MarkdownContent>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function ResearchChart({ chartJson }: { chartJson: string }) {
  const chart = JSON.parse(chartJson) as ChartData;
  const sourceUrl = chart.source ? getExternalUrl(chart.source) : undefined;

  return (
    <figure data-report-chart className="my-8 flex flex-col gap-4">
      <div className="flex flex-col gap-1 text-center">
        <h3 className="font-semibold">{chart.title}</h3>

        {chart.unit && (
          <p className="text-muted-foreground text-sm">单位：{chart.unit}</p>
        )}
      </div>

      {chart.type === "pie" ? (
        <ResearchPieChart chart={chart} />
      ) : (
        <ResearchCartesianChart chart={chart} />
      )}

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

function ResearchPieChart({ chart }: { chart: ChartData }) {
  const pieData = chart.categories.map((_, index) => ({
    categoryKey: `category_${index}`,
    value: chart.series[0].data[index],
    fill: `var(--color-category_${index})`,
  }));

  const chartConfig: ChartConfig = Object.fromEntries(
    chart.categories.map((label, index) => [
      `category_${index}`,
      { label, color: CHART_COLORS[index % CHART_COLORS.length] },
    ]),
  );

  return (
    <ChartContainer config={chartConfig}>
      <PieChart>
        <ChartTooltip
          content={<ChartTooltipContent nameKey="categoryKey" hideLabel />}
        />
        <ChartLegend
          content={
            <ChartLegendContent nameKey="categoryKey" className="flex-wrap" />
          }
        />
        <Pie
          data={pieData}
          dataKey="value"
          nameKey="categoryKey"
          isAnimationActive={false}
        />
      </PieChart>
    </ChartContainer>
  );
}

function ResearchCartesianChart({ chart }: { chart: ChartData }) {
  const series = chart.series.map((seriesItem, index) => ({
    ...seriesItem,
    key: `series_${index}`,
  }));

  const chartData = chart.categories.map((category, index) => ({
    category,
    ...Object.fromEntries(
      series.map((seriesItem) => [seriesItem.key, seriesItem.data[index]]),
    ),
  }));

  const chartConfig: ChartConfig = Object.fromEntries(
    series.map((seriesItem, index) => [
      seriesItem.key,
      {
        label: seriesItem.name,
        color: CHART_COLORS[index % CHART_COLORS.length],
      },
    ]),
  );

  return (
    <ChartContainer config={chartConfig}>
      <ComposedChart data={chartData}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="category" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent className="flex-wrap" />} />

        {series.map((seriesItem) => {
          const color = `var(--color-${seriesItem.key})`;

          if (chart.type === "line") {
            return (
              <Line
                key={seriesItem.key}
                type="monotone"
                dataKey={seriesItem.key}
                stroke={color}
                isAnimationActive={false}
              />
            );
          }

          if (chart.type === "area") {
            return (
              <Area
                key={seriesItem.key}
                type="monotone"
                dataKey={seriesItem.key}
                stroke={color}
                fill={color}
                isAnimationActive={false}
              />
            );
          }

          return (
            <Bar
              key={seriesItem.key}
              dataKey={seriesItem.key}
              fill={color}
              isAnimationActive={false}
            />
          );
        })}
      </ComposedChart>
    </ChartContainer>
  );
}

export function getReportTitle(report: string): string {
  return report.match(/^#\s+(.+)$/m)?.[1]?.trim() || "调研报告";
}

function getExternalUrl(value: string): string | undefined {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:"
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}
