"use client";

import { MarkdownContent } from "@/components/shared/markdown-content";
import type { ResearchPlanPublic } from "@/lib/client";
import type { ResearchState } from "@/lib/conversation-state";
import { cn } from "@/lib/utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useAuiState } from "@assistant-ui/react";
import type {
  LangChainMessage,
  LangChainToolCall,
} from "@assistant-ui/react-langgraph";
import {
  BookOpenTextIcon,
  ChevronDownIcon,
  CircleXIcon,
  ClipboardListIcon,
  FileCheckIcon,
  FilePenLineIcon,
  FileSearchIcon,
  ListTreeIcon,
  SearchIcon,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ResearchReport } from "./research-report";

type ToolStep = {
  id: string;
  name: string;
  args: LangChainToolCall["args"];
  result?: unknown;
  status?: "success" | "error";
};
type StageState = "done" | "active" | "pending" | "failed" | "stopped";

type ResearchStage = NonNullable<ResearchState["stage"]>;

const STAGES: ResearchStage[] = [
  "plan",
  "research",
  "outline",
  "draft",
  "finalize",
  "complete",
];

const TOOL_LABELS: Record<string, string> = {
  "firecrawl-firecrawl_search": "网页搜索",
  "firecrawl-firecrawl_scrape": "网页抓取",
};

const STAGE_LABELS: Record<ResearchStage, string> = {
  plan: "任务规划",
  research: "资料调研",
  outline: "大纲编写",
  draft: "报告编写",
  finalize: "最终报告",
  complete: "最终报告",
};
const STATUS_LABELS: Record<StageState, string> = {
  done: "已完成",
  active: "进行中",
  pending: "等待中",
  failed: "失败",
  stopped: "已停止",
};
const STATUS_CLASSES: Record<StageState, string> = {
  done: "border-green-200 bg-green-50 text-green-700",
  active: "border-blue-200 bg-blue-50 text-blue-700",
  pending: "border-gray-200 bg-gray-50 text-gray-700",
  failed: "border-red-200 bg-red-50 text-red-700",
  stopped: "border-gray-200 bg-gray-50 text-gray-700",
};

const DATE_TIME_FORMAT = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeStyle: "medium",
  hour12: false,
});

function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours} 小时 ${minutes} 分 ${seconds} 秒`;
  if (minutes > 0) return `${minutes} 分 ${seconds} 秒`;
  return `${seconds} 秒`;
}

function ResearchRunMeta({
  startedAt,
  finishedAt,
  running,
}: {
  startedAt: string;
  finishedAt?: string;
  running: boolean;
}) {
  const started = Date.parse(startedAt);
  const finished = finishedAt ? Date.parse(finishedAt) : undefined;
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (!running || finished !== undefined) return;

    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [finished, running]);

  if (Number.isNaN(started)) return null;

  const end = finished !== undefined && !Number.isNaN(finished) ? finished : now;

  return (
    <div className="text-muted-foreground flex flex-wrap gap-x-6 gap-y-1 text-sm">
      <span>开始时间：{DATE_TIME_FORMAT.format(started)}</span>
      <span>用时：{formatDuration(Math.max(0, end - started))}</span>
    </div>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseResult(content: unknown): unknown {
  if (Array.isArray(content)) {
    const textBlock = content.find(
      (item) =>
        isRecord(item) &&
        item.type === "text" &&
        typeof item.text === "string",
    );

    content = textBlock?.text ?? content;
  }

  if (typeof content !== "string") return content;

  try {
    return JSON.parse(content);
  } catch {
    return content;
  }
}

function isWebUrl(value: string): boolean {
  return value.startsWith("https://") || value.startsWith("http://");
}

function toolSteps(messages: readonly LangChainMessage[]): ToolStep[] {
  const steps = new Map<string, ToolStep>();

  for (const message of messages) {
    if (message.type === "ai") {
      for (const call of message.tool_calls ?? []) {
        steps.set(call.id, {
          id: call.id,
          name: call.name,
          args: call.args,
        });
      }
    }

    if (message.type === "tool") {
      const step = steps.get(message.tool_call_id);
      if (step) {
        steps.set(message.tool_call_id, {
          ...step,
          result: message.content,
          status: message.status,
        });
      }
    }
  }

  return [...steps.values()];
}

function status(
  stage: ResearchState["stage"],
  target: ResearchStage,
  done: boolean,
  runStatus: ResearchState["runStatus"],
): StageState {
  if (done) return "done";
  const current = STAGES.indexOf(stage ?? "plan");
  const expected = STAGES.indexOf(target);
  if (current > expected) return "done";
  if (current === expected) {
    if (runStatus === "failed") return "failed";
    if (runStatus === "cancelled") return "stopped";
    return "active";
  }
  return "pending";
}

function Plan({ plan }: { plan: ResearchPlanPublic }) {
  return (
    <div className="flex flex-col gap-4 text-sm">
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
        <ul className="text-muted-foreground flex list-disc flex-col gap-1 pl-5">
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

function ToolDetails({ step }: { step: ToolStep }) {
  const args = step.args;
  const result = step.result === undefined ? undefined : parseResult(step.result);

  if (step.status === "error") {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {TOOL_LABELS[step.name] ?? "工具"}调用失败。
        </AlertDescription>
      </Alert>
    );
  }

  if (step.name === "firecrawl-firecrawl_search") {
    const query = typeof args.query === "string" ? args.query : undefined;

    if (result === undefined) {
      return (
        <p className="text-muted-foreground text-sm">
          正在搜索{query ? `“${query}”` : "相关资料"}…
        </p>
      );
    }

    const data =
      isRecord(result) && isRecord(result.data) ? result.data : undefined;
    const results = Array.isArray(data?.web) ? data.web.filter(isRecord) : [];

    return (
      <div className="grid gap-2">
        <p className="text-muted-foreground text-sm">
          网页搜索完成：围绕 {query ? `“${query}”` : "相关资料"} 找到 {results.length} 条结果。
        </p>
        {results.length > 0 && (
          <ul className="grid gap-1 text-sm">
            {results.slice(0, 5).map((item, index) => {
              const url = typeof item.url === "string" ? item.url : undefined;
              const title = typeof item.title === "string" ? item.title : url;

              return (
                <li key={`${url ?? "result"}-${index}`}>
                  {url && isWebUrl(url) ? (
                    <a
                      className="font-medium underline underline-offset-4"
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {title}
                    </a>
                  ) : (
                    <span className="font-medium">
                      {title ?? `结果 ${index + 1}`}
                    </span>
                  )}
                </li>
              );
            })}
            {results.length > 5 && (
              <li className="text-muted-foreground">
                另有 {results.length - 5} 条结果
              </li>
            )}
          </ul>
        )}
      </div>
    );
  }

  if (step.name === "firecrawl-firecrawl_scrape") {
    const url = typeof args.url === "string" ? args.url : undefined;
    const metadata =
      isRecord(result) && isRecord(result.metadata)
        ? result.metadata
        : undefined;
    const title =
      typeof metadata?.title === "string" ? metadata.title : undefined;

    if (result === undefined) {
      return (
        <p className="text-muted-foreground text-sm">
          正在抓取{url ? ` ${url}` : "网页"}正文…
        </p>
      );
    }

    return (
      <p className="text-muted-foreground text-sm">
        网页抓取完成：已读取
        {url && isWebUrl(url) ? (
          <a
            className="mx-1 underline underline-offset-4"
            href={url}
            target="_blank"
            rel="noreferrer"
          >
            {title || url}
          </a>
        ) : (
          title || "网页"
        )}
        正文，可供报告引用。
      </p>
    );
  }

  if (result === undefined) {
    return <p className="text-muted-foreground text-sm">正在调用工具…</p>;
  }

  return <p className="text-muted-foreground text-sm">工具调用完成。</p>;
}

function StageCard({
  value,
  title,
  icon: Icon,
  state,
  children,
}: {
  value: string;
  title: string;
  icon: LucideIcon;
  state: StageState;
  children?: ReactNode;
}) {
  return (
    <AccordionItem value={value}>
      <AccordionTrigger>
        <span className="flex flex-1 items-center gap-2">
          <Icon
            className="text-muted-foreground size-4 shrink-0"
            aria-hidden="true"
          />
          <span>{title}</span>
          <Badge
            className={cn("ml-auto", STATUS_CLASSES[state])}
            variant="outline"
          >
            {STATUS_LABELS[state]}
          </Badge>
        </span>
      </AccordionTrigger>
      <AccordionContent>
        {children ?? (
          <StageOutput>
            <p className="text-muted-foreground text-sm">
              {state === "pending"
                ? "该阶段尚未开始。"
                : "暂无可展示的详细记录。"}
            </p>
          </StageOutput>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}

function StageOutput({ children }: { children: ReactNode }) {
  return <div className="rounded-lg bg-muted/50 p-4">{children}</div>;
}

function ToolSteps({
  steps,
  runStatus,
}: {
  steps: ToolStep[];
  runStatus: ResearchState["runStatus"];
}) {
  return (
    <Accordion className="grid gap-3 py-2 pl-6" type="multiple">
      {steps.map((step) => {
        const Icon =
          step.name === "firecrawl-firecrawl_scrape"
            ? FileSearchIcon
            : SearchIcon;
        const stepState: StageState =
          step.status === "error"
            ? "failed"
            : step.result !== undefined
              ? "done"
              : runStatus === "failed"
                ? "failed"
                : runStatus === "cancelled"
                  ? "stopped"
                  : "active";

        return (
          <AccordionItem
            className="bg-muted/50 rounded-lg border-0 px-4"
            key={step.id}
            value={step.id}
          >
            <AccordionTrigger className="py-3 hover:no-underline">
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <Icon
                  className="text-muted-foreground size-4 shrink-0"
                  aria-hidden="true"
                />
                <span className="truncate">
                  {TOOL_LABELS[step.name] ?? step.name}
                </span>
                <Badge
                  className={cn("ml-auto", STATUS_CLASSES[stepState])}
                  variant="outline"
                >
                  {STATUS_LABELS[stepState]}
                </Badge>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <ToolDetails step={step} />
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}

export function ResearchProgress() {
  const state = useAuiState(
    (value) => value.thread.state,
  ) as ResearchState | null;
  const threadId = useAuiState((value) => value.threads.mainThreadId);
  const hasStarted = useAuiState((value) => value.thread.messages.length > 0);
  const stage = state?.stage;
  const runStatus = state?.runStatus;
  const stageLabel = stage ? STAGE_LABELS[stage] : "当前阶段";
  const [openStages, setOpenStages] = useState<string[]>(["plan"]);

  useEffect(() => {
    const current = stage === "complete" ? "finalize" : stage;
    setOpenStages([current ?? "plan"]);
  }, [stage, threadId]);

  const researchMessages = state?.researchMessages;
  const steps = useMemo(
    () => toolSteps(researchMessages ?? []),
    [researchMessages],
  );

  if (state?.loadError) {
    return (
      <Alert className="mb-12" variant="destructive">
        <CircleXIcon aria-hidden="true" />
        <AlertTitle>会话加载失败</AlertTitle>
        <AlertDescription>{state.loadError}</AlertDescription>
      </Alert>
    );
  }

  if (!state || (!hasStarted && runStatus !== "failed")) return null;

  return (
    <div className="mb-12">
      <section className="px-6" aria-label="调研进度">
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {runStatus === "running"
            ? `当前调研阶段：${stageLabel}`
            : runStatus === "completed"
              ? "调研已完成"
              : ""}
        </p>
        <Collapsible
          key={`${threadId}:${Boolean(state.report)}`}
          defaultOpen={!state.report}
        >
          <div className="mb-3 flex items-start justify-between gap-4">
            {state.runStartedAt && (
              <ResearchRunMeta
                startedAt={state.runStartedAt}
                finishedAt={state.runFinishedAt}
                running={runStatus === "running"}
              />
            )}
            {state.report && (
              <CollapsibleTrigger asChild>
                <Button
                  className="group shrink-0"
                  type="button"
                  variant="ghost"
                  size="sm"
                >
                  调研过程
                  <ChevronDownIcon className="transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none" />
                </Button>
              </CollapsibleTrigger>
            )}
          </div>
          <CollapsibleContent>
            <Accordion
              type="multiple"
              value={openStages}
              onValueChange={setOpenStages}
            >
              <StageCard
                value="plan"
                title="任务规划"
                icon={ClipboardListIcon}
                state={status(stage, "plan", Boolean(state.plan), runStatus)}
              >
                {state.plan && (
                  <StageOutput>
                    <Plan plan={state.plan} />
                  </StageOutput>
                )}
              </StageCard>

              <StageCard
                value="research"
                title="资料调研"
                icon={BookOpenTextIcon}
                state={status(
                  stage,
                  "research",
                  stage !== "research" && steps.length > 0,
                  runStatus,
                )}
              >
                {steps.length > 0 ? (
                  <ToolSteps
                    key={threadId}
                    steps={steps}
                    runStatus={runStatus}
                  />
                ) : stage === "research" && runStatus === "running" ? (
                  <StageOutput>
                    <p className="text-muted-foreground text-sm">
                      正在准备工具调用…
                    </p>
                  </StageOutput>
                ) : null}
              </StageCard>

              <StageCard
                value="outline"
                title="大纲编写"
                icon={ListTreeIcon}
                state={status(
                  stage,
                  "outline",
                  Boolean(state.outline),
                  runStatus,
                )}
              >
                {state.outline && (
                  <StageOutput>
                    <MarkdownContent className="max-w-none text-sm">
                      {state.outline}
                    </MarkdownContent>
                  </StageOutput>
                )}
              </StageCard>
              <StageCard
                value="draft"
                title="报告编写"
                icon={FilePenLineIcon}
                state={status(stage, "draft", Boolean(state.draft), runStatus)}
              >
                {state.draft && (
                  <StageOutput>
                    <MarkdownContent className="max-w-none text-sm">
                      {state.draft}
                    </MarkdownContent>
                  </StageOutput>
                )}
              </StageCard>
              <StageCard
                value="finalize"
                title="最终报告"
                icon={FileCheckIcon}
                state={status(
                  stage,
                  "finalize",
                  Boolean(state.report),
                  runStatus,
                )}
              >
                {state.report && (
                  <StageOutput>
                    <p className="text-muted-foreground">
                      报告已生成，请查看下方完整报告。
                    </p>
                  </StageOutput>
                )}
              </StageCard>
            </Accordion>
          </CollapsibleContent>
        </Collapsible>
      </section>

      {state.report && <ResearchReport report={state.report} />}
      {runStatus === "failed" && (
        <Alert className="mt-3" variant="destructive">
          <CircleXIcon aria-hidden="true" />
          <AlertTitle>调研失败</AlertTitle>
          <AlertDescription>
            {state.runError || `调研在“${stageLabel}”阶段失败，请重新发起调研。`}
          </AlertDescription>
        </Alert>
      )}
      {runStatus === "cancelled" && (
        <Alert className="mt-3">
          <AlertTitle>调研已停止</AlertTitle>
          <AlertDescription>任务已取消，后续阶段不会继续执行。</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
