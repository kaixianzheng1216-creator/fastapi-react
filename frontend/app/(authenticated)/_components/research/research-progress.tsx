"use client";

import { MarkdownContent } from "@/components/common/markdown-content";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { ResearchPlanPublic } from "@/lib/client";
import type { ResearchState } from "@/lib/conversation-state";

import { useAuiState } from "@assistant-ui/react";
import type {
  LangChainMessage,
  LangChainToolCall,
} from "@assistant-ui/react-langgraph";
import {
  BookOpenTextIcon,
  ChevronDownIcon,
  ClipboardListIcon,
  FileCheckIcon,
  FilePenLineIcon,
  FileSearchIcon,
  ListTreeIcon,
  SearchIcon,
  type LucideIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useMemo, type ReactNode } from "react";

const ResearchReport = dynamic(() =>
  import("./research-report").then((module) => module.ResearchReport),
);

type ResearchStage = NonNullable<ResearchState["stage"]>;

const STAGE_ORDER: ResearchStage[] = [
  "plan",
  "research",
  "outline",
  "draft",
  "finalize",
  "complete",
];

const STAGE_LABELS: Record<ResearchStage, string> = {
  plan: "任务规划",
  research: "资料调研",
  outline: "大纲编写",
  draft: "报告编写",
  finalize: "最终报告",
  complete: "最终报告",
};

const STATUS_BADGES = {
  done: { label: "已完成", variant: "secondary" },
  active: { label: "进行中", variant: "default" },
  pending: { label: "等待中", variant: "outline" },
  failed: { label: "失败", variant: "destructive" },
  stopped: { label: "已停止", variant: "outline" },
} as const;

type ProgressStatus = keyof typeof STATUS_BADGES;

const TOOL_LABELS = {
  "firecrawl-firecrawl_search": "网页搜索",
  "firecrawl-firecrawl_scrape": "网页抓取",
} as const;

const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeStyle: "medium",
  hour12: false,
});

type ResearchToolName = keyof typeof TOOL_LABELS;

type ToolStep = {
  id: string;
  name: ResearchToolName;
  args: LangChainToolCall["args"];
  resultText?: string;
  status?: "success" | "error";
};

export function ResearchProgress() {
  const researchState = useAuiState(
    (value) => value.thread.state,
  ) as ResearchState | null;
  const threadId = useAuiState((value) => value.threads.mainThreadId);

  const currentStage = researchState?.stage;
  const runStatus = researchState?.runStatus;
  const researchMessages = researchState?.researchMessages;
  const toolSteps = useMemo(
    () => getToolSteps(researchMessages ?? []),
    [researchMessages],
  );

  if (researchState?.isLoading) return null;

  if (!researchState || !currentStage) {
    return runStatus === "failed" ? (
      <p role="status" className="text-muted-foreground text-sm">
        {researchState?.runError || "调研失败，请重新提交"}
      </p>
    ) : null;
  }

  const currentStageLabel = STAGE_LABELS[currentStage];

  const {
    plan,
    outline,
    draft,
    report,
    runStartedAt,
    runFinishedAt,
    runError,
  } = researchState;

  let researchContent: ReactNode = null;

  if (toolSteps.length > 0) {
    researchContent = <ToolSteps toolSteps={toolSteps} runStatus={runStatus} />;
  } else if (currentStage === "research" && runStatus === "running") {
    researchContent = (
      <p className="text-muted-foreground">正在准备工具调用…</p>
    );
  }

  return (
    <div className="mb-12">
      <section className="px-6" aria-label="调研进度">
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {runStatus === "running"
            ? `当前调研阶段：${currentStageLabel}`
            : runStatus === "completed"
              ? "调研已完成"
              : ""}
        </p>

        <Collapsible key={threadId} defaultOpen={!report}>
          {report && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              {runStartedAt && runFinishedAt ? (
                <ResearchTiming
                  startedAt={runStartedAt}
                  finishedAt={runFinishedAt}
                />
              ) : null}

              <CollapsibleTrigger asChild>
                <Button
                  className="group ml-auto"
                  type="button"
                  variant="ghost"
                  size="sm"
                >
                  调研过程
                  <ChevronDownIcon className="transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none" />
                </Button>
              </CollapsibleTrigger>
            </div>
          )}

          <CollapsibleContent>
            <Accordion type="multiple">
              <ResearchStageItem
                value="plan"
                icon={ClipboardListIcon}
                status={getStageStatus(currentStage, "plan", runStatus)}
              >
                {plan && <ResearchPlan plan={plan} />}
              </ResearchStageItem>

              <ResearchStageItem
                value="research"
                icon={BookOpenTextIcon}
                status={getStageStatus(currentStage, "research", runStatus)}
              >
                {researchContent}
              </ResearchStageItem>

              <ResearchStageItem
                value="outline"
                icon={ListTreeIcon}
                status={getStageStatus(currentStage, "outline", runStatus)}
              >
                {outline && (
                  <MarkdownContent className="max-w-none text-sm">
                    {outline}
                  </MarkdownContent>
                )}
              </ResearchStageItem>

              <ResearchStageItem
                value="draft"
                icon={FilePenLineIcon}
                status={getStageStatus(currentStage, "draft", runStatus)}
              >
                {draft && (
                  <MarkdownContent className="max-w-none text-sm">
                    {draft}
                  </MarkdownContent>
                )}
              </ResearchStageItem>

              <ResearchStageItem
                value="finalize"
                icon={FileCheckIcon}
                status={getStageStatus(currentStage, "finalize", runStatus)}
              >
                {report && (
                  <p className="text-muted-foreground">
                    报告已生成，请查看下方完整报告。
                  </p>
                )}
              </ResearchStageItem>
            </Accordion>
          </CollapsibleContent>
        </Collapsible>
      </section>

      {report && <ResearchReport report={report} />}

      {runStatus === "failed" && (
        <div role="status" className="my-3 flex flex-col gap-1 text-sm">
          <span className="font-medium">调研失败</span>
          <p className="text-muted-foreground">
            {runError || "调研失败，请重新提交"}
          </p>
        </div>
      )}

      {runStatus === "cancelled" && (
        <div role="status" className="my-3 flex flex-col gap-1 text-sm">
          <span className="font-medium">调研已停止</span>
          <p className="text-muted-foreground">
            任务已取消，后续阶段不会继续执行。
          </p>
        </div>
      )}
    </div>
  );
}

function ResearchTiming({
  startedAt,
  finishedAt,
}: {
  startedAt: string;
  finishedAt: string;
}) {
  const startTime = Date.parse(startedAt);
  const totalSeconds = Math.max(
    0,
    Math.floor((Date.parse(finishedAt) - startTime) / 1000),
  );
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const duration = [
    hours > 0 ? `${hours}小时` : "",
    minutes > 0 ? `${minutes}分` : "",
    `${seconds}秒`,
  ].join("");

  return (
    <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
      <span>开始时间：{dateTimeFormatter.format(startTime)}</span>
      <span>用时：{duration}</span>
    </div>
  );
}

function getStageStatus(
  currentStage: ResearchStage,
  targetStage: ResearchStage,
  runStatus: ResearchState["runStatus"],
): ProgressStatus {
  const currentIndex = STAGE_ORDER.indexOf(currentStage);
  const targetIndex = STAGE_ORDER.indexOf(targetStage);

  if (currentIndex > targetIndex) return "done";
  if (currentIndex < targetIndex) return "pending";

  if (runStatus === "failed") return "failed";
  if (runStatus === "cancelled") return "stopped";

  return "active";
}

function ResearchStageItem({
  value,
  icon,
  status,
  children,
}: {
  value: ResearchStage;
  icon: LucideIcon;
  status: ProgressStatus;
  children?: ReactNode;
}) {
  return (
    <AccordionItem value={value}>
      <ProgressHeader title={STAGE_LABELS[value]} icon={icon} status={status} />
      <AccordionContent>
        <div className="rounded-lg bg-muted/50 p-4">
          {children || (
            <p className="text-muted-foreground">
              {status === "pending"
                ? "该阶段尚未开始。"
                : "暂无可展示的详细记录。"}
            </p>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function ProgressHeader({
  title,
  icon: Icon,
  status,
}: {
  title: string;
  icon: LucideIcon;
  status: ProgressStatus;
}) {
  const { label, variant } = STATUS_BADGES[status];

  return (
    <AccordionTrigger>
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <Icon
          className="text-muted-foreground size-4 shrink-0"
          aria-hidden="true"
        />
        <span className="truncate">{title}</span>
        <Badge className="ml-auto" variant={variant}>
          {label}
        </Badge>
      </span>
    </AccordionTrigger>
  );
}

function ResearchPlan({ plan }: { plan: ResearchPlanPublic }) {
  return (
    <div className="grid gap-4">
      <div>
        <div className="mb-1 font-medium">意图理解</div>
        <p className="text-muted-foreground leading-6">{plan.intent}</p>
      </div>

      {plan.period && (
        <div>
          <div className="mb-1 font-medium">研究周期</div>
          <div className="text-muted-foreground">
            {plan.period.start} 至 {plan.period.end}
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 font-medium">核心问题</div>
        <ul className="text-muted-foreground grid list-disc gap-1 pl-5">
          {plan.questions.map((question) => (
            <li key={question}>{question}</li>
          ))}
        </ul>
      </div>

      {plan.metrics.length > 0 && (
        <div>
          <div className="mb-2 font-medium">候选指标</div>
          <div className="flex flex-wrap gap-2">
            {plan.metrics.map((metric) => (
              <Badge key={metric} variant="secondary">
                {metric}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function getToolSteps(messages: readonly LangChainMessage[]): ToolStep[] {
  const stepsById = new Map<string, ToolStep>();

  for (const message of messages) {
    if (message.type === "ai") {
      for (const call of message.tool_calls ?? []) {
        stepsById.set(call.id, {
          id: call.id,
          name: call.name as ResearchToolName,
          args: call.args,
        });
      }
    }

    if (message.type === "tool") {
      const step = stepsById.get(message.tool_call_id);
      const result = Array.isArray(message.content)
        ? message.content[0]
        : undefined;

      if (!step) continue;

      if (
        isRecord(result) &&
        result.type === "text" &&
        typeof result.text === "string"
      ) {
        step.resultText = result.text;
      }
      step.status = message.status;
    }
  }

  return [...stepsById.values()];
}

function ToolSteps({
  toolSteps,
  runStatus,
}: {
  toolSteps: ToolStep[];
  runStatus: ResearchState["runStatus"];
}) {
  return (
    <Accordion type="multiple">
      {toolSteps.map((step) => {
        let toolStatus: ProgressStatus = "active";

        if (step.status === "error") toolStatus = "failed";
        else if (step.resultText !== undefined) toolStatus = "done";
        else if (runStatus === "failed") toolStatus = "failed";
        else if (runStatus === "cancelled") toolStatus = "stopped";

        return (
          <AccordionItem key={step.id} value={step.id}>
            <ProgressHeader
              title={TOOL_LABELS[step.name]}
              icon={
                step.name === "firecrawl-firecrawl_scrape"
                  ? FileSearchIcon
                  : SearchIcon
              }
              status={toolStatus}
            />
            <AccordionContent className="text-muted-foreground">
              <ToolDetails step={step} status={toolStatus} />
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}

function ToolDetails({
  step,
  status,
}: {
  step: ToolStep;
  status: ProgressStatus;
}) {
  if (step.status === "error") {
    return (
      <div role="status" className="my-3 flex flex-col gap-1 text-sm">
        <p className="text-muted-foreground">
          {TOOL_LABELS[step.name]}调用失败。
        </p>
      </div>
    );
  }

  if (status === "stopped" || status === "failed") {
    return <p>工具调用已中断，未收到结果。</p>;
  }

  if (step.name === "firecrawl-firecrawl_search") {
    const query =
      typeof step.args.query === "string" ? step.args.query : "当前主题";

    if (step.resultText === undefined) return <p>正在搜索“{query}”…</p>;

    const result = parseJson(step.resultText);
    const data = isRecord(result) && isRecord(result.data) ? result.data : null;
    const searchResults = Array.isArray(data?.web)
      ? data.web.filter(isSearchResult)
      : null;

    if (!searchResults) return <p>网页搜索结果暂时无法显示。</p>;

    return (
      <div className="grid gap-2">
        <p>
          网页搜索完成：围绕“{query}”找到 {searchResults.length} 条结果。
        </p>
        {searchResults.length > 0 && (
          <ul className="grid gap-1">
            {searchResults.slice(0, 5).map((page) => (
              <li className="font-medium" key={page.url}>
                <a
                  className="underline underline-offset-4"
                  href={page.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {page.title}
                </a>
              </li>
            ))}
            {searchResults.length > 5 && (
              <li>另有 {searchResults.length - 5} 条结果</li>
            )}
          </ul>
        )}
      </div>
    );
  }

  const url = typeof step.args.url === "string" ? step.args.url : "";

  if (step.resultText === undefined) {
    return <p>正在抓取{url ? ` ${url}` : "网页"}正文…</p>;
  }

  const result = parseJson(step.resultText);
  const metadata =
    isRecord(result) && isRecord(result.metadata) ? result.metadata : null;

  if (!metadata) return <p>网页抓取结果暂时无法显示。</p>;

  const title = typeof metadata.title === "string" ? metadata.title : url;

  if (!url) return <p>网页抓取完成，正文可供报告引用。</p>;

  return (
    <p>
      网页抓取完成：已读取
      <a
        className="mx-1 underline underline-offset-4"
        href={url}
        target="_blank"
        rel="noreferrer"
      >
        {title}
      </a>
      正文，可供报告引用。
    </p>
  );
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSearchResult(
  value: unknown,
): value is { title: string; url: string } {
  return (
    isRecord(value) &&
    typeof value.title === "string" &&
    typeof value.url === "string"
  );
}
