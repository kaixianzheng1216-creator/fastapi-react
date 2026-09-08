"use client";

import {
  getReportTitle,
  ResearchReportContent,
} from "@/app/(authenticated)/_components/research/research-report";
import { useEffect, useState } from "react";
import styles from "./report-print.module.css";

declare global {
  interface Window {
    __REPORT__?: string;
  }
}

export function PrintReport() {
  const [report, setReport] = useState<string | null>();

  useEffect(() => {
    const injectedReport = window.__REPORT__;

    if (!injectedReport) {
      document.documentElement.dataset.reportPrintStatus = "error";
      setReport(null);
      return;
    }

    document.title = getReportTitle(injectedReport);
    setReport(injectedReport);
  }, []);

  useEffect(() => {
    if (!report) return;

    async function waitForReportRender() {
      const imageLoads = Array.from(document.images, (image) => {
        image.loading = "eager";
        return image.decode();
      });
      const charts = Array.from(
        document.querySelectorAll<HTMLElement>("[data-report-chart]"),
      );

      await Promise.all([document.fonts.ready, ...imageLoads]);

      while (
        charts.some((chart) => {
          const svg = chart.querySelector("svg");

          return !svg || svg.clientWidth === 0 || svg.clientHeight === 0;
        })
      ) {
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
      }

      document.documentElement.dataset.reportPrintStatus = "ready";
    }

    void waitForReportRender().catch(() => {
      document.documentElement.dataset.reportPrintStatus = "error";
    });
  }, [report]);

  if (report === undefined) return <main>正在准备报告…</main>;

  if (report === null) return <main>报告数据无效</main>;

  return (
    <main className={styles.report}>
      <ResearchReportContent report={report} />
    </main>
  );
}
