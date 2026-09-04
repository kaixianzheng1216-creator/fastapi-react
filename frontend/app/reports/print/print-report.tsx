"use client";

import {
  reportChartCount,
  ResearchReportContent,
} from "@/app/(authenticated)/_components/research/research-report-content";
import { useEffect, useState } from "react";
import styles from "./report-print.module.css";

declare global {
  interface Window {
    __REPORT__?: string;
  }
}

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; report: string };

export function PrintReport() {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    document.documentElement.dataset.reportPrintStatus = "loading";

    const report = window.__REPORT__;
    if (!report) {
      document.documentElement.dataset.reportPrintStatus = "error";
      setLoadState({ status: "error" });
      return;
    }

    document.title = report.match(/^#\s+(.+)$/m)?.[1]?.trim() || "调研报告";
    setLoadState({ status: "ready", report });
  }, []);

  useEffect(() => {
    if (loadState.status !== "ready") return;

    let current = true;
    const expectedChartCount = reportChartCount(loadState.report);

    async function markReadyWhenRendered() {
      const images = Array.from(document.images);
      images.forEach((image) => {
        image.loading = "eager";
      });
      await document.fonts.ready;
      await Promise.all(images.map((image) => image.decode()));

      while (current) {
        const renderedChartCount = Array.from(
          document.querySelectorAll<HTMLElement>("[data-report-chart]"),
        ).filter((chart) => {
          const bounds = chart.querySelector("svg")?.getBoundingClientRect();
          return bounds && bounds.width > 0 && bounds.height > 0;
        }).length;
        const invalidChartCount = document.querySelectorAll(
          "[data-report-chart-error]",
        ).length;

        if (renderedChartCount + invalidChartCount >= expectedChartCount) {
          break;
        }

        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
      }

      if (!current) return;
      if (document.querySelector("[data-report-block-error]")) {
        document.documentElement.dataset.reportPrintStatus = "error";
        return;
      }

      document.documentElement.dataset.reportPrintStatus = "ready";
    }

    void markReadyWhenRendered().catch(() => {
      if (current) {
        document.documentElement.dataset.reportPrintStatus = "error";
      }
    });

    return () => {
      current = false;
    };
  }, [loadState]);

  if (loadState.status === "loading") {
    return <main className={styles.message}>正在准备报告…</main>;
  }

  if (loadState.status === "error") {
    return <main className={styles.message}>报告数据无效</main>;
  }

  return (
    <main className={styles.page}>
      <article className={styles.report}>
        <ResearchReportContent report={loadState.report} />
      </article>
    </main>
  );
}
