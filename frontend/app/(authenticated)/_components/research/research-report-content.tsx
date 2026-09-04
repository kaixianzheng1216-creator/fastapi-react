"use client";

import { MarkdownContent } from "@/components/shared/markdown-content";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";
import { memo } from "react";
import { ResearchTextCard } from "./research-text-card";

const ResearchChart = dynamic(() =>
  import("./research-chart").then((module) => module.ResearchChart),
);

type ReportPart =
  | { type: "markdown"; value: string }
  | { type: "chart"; value: string }
  | { type: "cards"; values: string[] };

function splitReport(report: string): ReportPart[] {
  const parts: ReportPart[] = [];
  const pattern = /```(chart|card)\s*([\s\S]*?)```/g;
  let start = 0;

  for (const match of report.matchAll(pattern)) {
    const index = match.index ?? 0;
    const markdown = report.slice(start, index);

    if (markdown.trim()) {
      parts.push({ type: "markdown", value: markdown });
    }

    if (match[1] === "chart") {
      parts.push({ type: "chart", value: match[2] ?? "" });
    } else {
      const previous = parts.at(-1);

      if (previous?.type === "cards") {
        previous.values.push(match[2] ?? "");
      } else {
        parts.push({ type: "cards", values: [match[2] ?? ""] });
      }
    }

    start = index + match[0].length;
  }

  if (start < report.length) {
    parts.push({ type: "markdown", value: report.slice(start) });
  }

  return parts;
}

export function reportChartCount(report: string): number {
  return splitReport(report).filter((part) => part.type === "chart").length;
}

export const ResearchReportContent = memo(function ResearchReportContent({
  report,
}: {
  report: string;
}) {
  return splitReport(report).map((part, index) => {
    if (part.type === "chart") {
      return <ResearchChart key={index} value={part.value} />;
    }

    if (part.type === "cards") {
      return (
        <div
          key={index}
          data-report-card-grid
          className={cn(
            "my-8 grid gap-4",
            part.values.length === 3
              ? "md:grid-cols-3"
              : part.values.length > 1 && "md:grid-cols-2",
          )}
        >
          {part.values.map((value, cardIndex) => (
            <ResearchTextCard key={cardIndex} value={value} />
          ))}
        </div>
      );
    }

    return (
      <MarkdownContent
        key={index}
        className="max-w-none prose-headings:scroll-mt-20"
        headingPrefix={`research-section-${index}-`}
      >
        {part.value}
      </MarkdownContent>
    );
  });
});
