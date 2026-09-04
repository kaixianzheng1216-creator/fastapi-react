"use client";

import { useAuiState } from "@assistant-ui/react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { getApiErrorMessage } from "@/lib/api-error";
import { agentDownloadConversationReportPdf } from "@/lib/client";
import { cn } from "@/lib/utils";
import { ChevronsLeftIcon, DownloadIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { ResearchReportContent } from "./research-report-content";
import {
  ResearchTableOfContents,
  type ResearchHeading,
} from "./research-table-of-contents";

function pdfFilename(report: string): string {
  const title = report.match(/^#\s+(.+)$/m)?.[1];
  const filename = title?.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "").trim();
  return `${filename || "调研报告"}.pdf`;
}

export function ResearchReport({ report }: { report: string }) {
  const [exporting, setExporting] = useState(false);
  const [actionError, setActionError] = useState("");
  const [headings, setHeadings] = useState<ResearchHeading[]>([]);
  const [desktopTocOpen, setDesktopTocOpen] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const conversationId = useAuiState(
    (state) => state.threadListItem.remoteId,
  );

  useEffect(() => {
    const element = reportRef.current;
    if (!element) return;

    setHeadings(
      Array.from(
        element.querySelectorAll<HTMLHeadingElement>("h2[id], h3[id]"),
      ).flatMap((heading) => {
        const title = heading.textContent?.trim();

        return title
          ? [
              {
                id: heading.id,
                level: heading.tagName === "H2" ? 2 : 3,
                title,
              } satisfies ResearchHeading,
            ]
          : [];
      }),
    );
  }, [report]);

  async function downloadPdf() {
    if (!conversationId) {
      setActionError("报告尚未保存，请稍后重试。");
      return;
    }

    setExporting(true);
    setActionError("");

    try {
      const { data: blob } = await agentDownloadConversationReportPdf({
        path: { conversation_id: conversationId },
        parseAs: "blob",
        throwOnError: true,
      });

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = pdfFilename(report);
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      setActionError(getApiErrorMessage(error, "PDF 导出失败，请重试。"));
    } finally {
      setExporting(false);
    }
  }

  return (
    <article id="final-report" className="mt-8 scroll-mt-4">
      <div
        className={cn(
          "grid items-start gap-4 xl:gap-0",
          headings.length > 0 &&
            (desktopTocOpen
              ? "xl:grid-cols-[14rem_minmax(0,1fr)] xl:gap-6"
              : "xl:grid-cols-[2.5rem_minmax(0,1fr)]"),
        )}
      >
        {headings.length > 0 && !desktopTocOpen ? (
          <aside className="hidden self-stretch pt-4 xl:block">
            <Button
              variant="secondary"
              size="sm"
              className="sticky top-4 h-auto w-full flex-col rounded-r-none px-2 py-3 shadow-none"
              aria-label="展开报告目录"
              onClick={() => setDesktopTocOpen(true)}
            >
              <ChevronsLeftIcon data-icon="inline-start" />
              <span className="[writing-mode:vertical-rl]">展开目录</span>
            </Button>
          </aside>
        ) : null}
        {headings.length > 0 && (
          <ResearchTableOfContents
            desktopOpen={desktopTocOpen}
            headings={headings}
            onDesktopOpenChange={setDesktopTocOpen}
          />
        )}
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="sr-only">最终调研报告</CardTitle>
            <CardAction>
              <Button
                variant="outline"
                size="sm"
                disabled={exporting}
                aria-busy={exporting}
                onClick={() => void downloadPdf()}
              >
                {exporting ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <DownloadIcon data-icon="inline-start" />
                )}
                {exporting ? "正在下载…" : "下载 PDF"}
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {actionError && (
              <Alert variant="destructive">
                <AlertDescription>{actionError}</AlertDescription>
              </Alert>
            )}
            <div ref={reportRef} className="min-w-0">
              <ResearchReportContent report={report} />
            </div>
          </CardContent>
        </Card>
      </div>
    </article>
  );
}
