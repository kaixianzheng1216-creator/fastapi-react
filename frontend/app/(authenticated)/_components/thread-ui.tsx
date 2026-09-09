"use client";

import {
  ComposerAddAttachment,
  ComposerAttachments,
  UserMessageAttachments,
} from "@/app/(authenticated)/_components/attachment";
import { ComposerModelSelector } from "@/app/(authenticated)/_components/composer-model-selector";
import { selectIsNewConversation } from "@/app/(authenticated)/_components/conversation-selectors";
import { TooltipIconButton } from "@/app/(authenticated)/_components/tooltip-icon-button";
import { ButtonLoading } from "@/components/shared/button-loading";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  AuiIf,
  useAui,
  useAuiState,
  ComposerPrimitive,
  MessagePrimitive,
  SuggestionPrimitive,
  ThreadPrimitive,
} from "@assistant-ui/react";
import { ArrowDownIcon, ArrowUpIcon, SquareIcon } from "lucide-react";
import type { ComponentProps, FC, PropsWithChildren, ReactNode } from "react";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { agentCancelAgentRun } from "@/lib/client";
import { getApiErrorMessage } from "@/lib/api-error";
import type { ApplicationState } from "@/lib/conversation-state";

export type ThreadWelcomeProps = {
  title: string;
};

type ThreadShellProps = PropsWithChildren<{
  isEmpty: boolean;
  maxWidth: string;
  footer: ReactNode;
  scrollToBottomOnLoad?: boolean;
}>;

export const ThreadShell: FC<ThreadShellProps> = ({
  isEmpty,
  maxWidth,
  footer,
  scrollToBottomOnLoad = true,
  children,
}) => (
  <ThreadPrimitive.Root
    className="aui-root aui-thread-root bg-background @container flex h-full flex-col"
    style={{
      ["--thread-max-width" as string]: maxWidth,
      ["--composer-bg" as string]:
        "color-mix(in oklab, var(--color-muted) 30%, var(--color-background))",
      ["--composer-radius" as string]: "1.5rem",
      ["--composer-padding" as string]: "8px",
    }}
  >
    <ThreadPrimitive.Viewport
      turnAnchor="top"
      scrollToBottomOnInitialize={scrollToBottomOnLoad}
      scrollToBottomOnThreadSwitch={scrollToBottomOnLoad}
      data-slot="aui_thread-viewport"
      className="relative flex flex-1 flex-col overflow-x-auto overflow-y-scroll scroll-smooth motion-reduce:scroll-auto 2xl:[scrollbar-width:none] 2xl:[&::-webkit-scrollbar]:hidden"
    >
      <div
        className={cn(
          "mx-auto flex w-full max-w-(--thread-max-width) flex-1 flex-col px-4 pt-4",
          isEmpty && "justify-center",
        )}
      >
        {children}

        <ThreadPrimitive.ViewportFooter
          className={cn(
            "aui-thread-viewport-footer bg-background flex flex-col gap-4 overflow-visible pb-4 md:pb-6",
            !isEmpty && "sticky bottom-0 mt-auto rounded-t-(--composer-radius)",
          )}
        >
          <ThreadScrollToBottom />
          {footer}
        </ThreadPrimitive.ViewportFooter>
      </div>
    </ThreadPrimitive.Viewport>
  </ThreadPrimitive.Root>
);

const ThreadScrollToBottom: FC = () => (
  <ThreadPrimitive.ScrollToBottom asChild>
    <TooltipIconButton
      tooltip="滚动到底部"
      variant="outline"
      className="aui-thread-scroll-to-bottom dark:border-border dark:bg-background dark:hover:bg-accent absolute -top-12 z-10 self-center rounded-full p-4 disabled:invisible"
    >
      <ArrowDownIcon />
    </TooltipIconButton>
  </ThreadPrimitive.ScrollToBottom>
);

export const ThreadWelcome: FC<ThreadWelcomeProps> = ({ title }) => (
  <div className="aui-thread-welcome-root mb-6 flex flex-col items-center px-4 text-center">
    <h1 className="aui-thread-welcome-message-inner fade-in slide-in-from-bottom-1 animate-in fill-mode-both text-2xl font-semibold duration-200 motion-reduce:animate-none">
      {title}
    </h1>
  </div>
);

export const ChatConversationSkeleton: FC = () => (
  <div
    role="status"
    aria-label="正在加载会话"
    className="flex flex-col gap-8 py-6"
  >
    <Skeleton className="ms-auto h-10 w-2/5 rounded-xl" />
    <div className="flex max-w-[85%] flex-col gap-3">
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/5" />
    </div>
    <Skeleton className="ms-auto h-10 w-1/3 rounded-xl" />
    <div className="flex max-w-[85%] flex-col gap-3">
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  </div>
);

export const ResearchConversationSkeleton: FC = () => (
  <div
    role="status"
    aria-label="正在加载调研"
    className="flex flex-col gap-8 py-6"
  >
    <Skeleton className="ms-auto h-10 w-2/5 rounded-xl" />

    <section className="px-6" aria-hidden="true">
      <div className="mb-4 flex gap-6">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-4 w-24" />
      </div>

      <div className="flex flex-col">
        {["plan", "research", "outline", "draft", "finalize"].map(
          (stage, index) => (
            <div key={stage} className="flex h-14 items-center gap-3 border-b">
              <Skeleton className="size-4 rounded-sm" />
              <Skeleton className={index === 1 ? "h-4 w-24" : "h-4 w-20"} />
              <Skeleton className="ms-auto h-5 w-14 rounded-full" />
            </div>
          ),
        )}
      </div>
    </section>
  </div>
);

export const ComposerSkeleton: FC = () => (
  <Skeleton
    aria-hidden="true"
    className="h-16 w-full rounded-(--composer-radius)"
  />
);

export const ThreadStarterSuggestions: FC = () => (
  <AuiIf
    condition={(state) =>
      selectIsNewConversation(state) && state.composer.isEmpty
    }
  >
    <div className="aui-thread-welcome-suggestions flex w-full flex-wrap items-center justify-center gap-2 px-4">
      <ThreadPrimitive.Suggestions>
        {() => <ThreadStarterSuggestion />}
      </ThreadPrimitive.Suggestions>
    </div>
  </AuiIf>
);

const ThreadStarterSuggestion: FC = () => (
  <div className="aui-thread-welcome-suggestion-display fade-in slide-in-from-bottom-2 animate-in fill-mode-both duration-200">
    <SuggestionPrimitive.Trigger send asChild>
      <Button
        variant="ghost"
        className="aui-thread-welcome-suggestion text-foreground hover:bg-muted border-border/60 h-auto gap-2 rounded-full border px-3.5 py-1.5 text-sm font-normal whitespace-nowrap transition-colors"
      >
        <SuggestionPrimitive.Title className="aui-thread-welcome-suggestion-text-1" />
        <SuggestionPrimitive.Description className="aui-thread-welcome-suggestion-text-2 empty:hidden" />
      </Button>
    </SuggestionPrimitive.Trigger>
  </div>
);

export const Composer: FC = () => (
  <ComposerPrimitive.Root className="aui-composer-root relative flex w-full flex-col">
    <ComposerPrimitive.AttachmentDropzone asChild>
      <div
        data-slot="aui_composer-shell"
        className="border-border/60 data-[dragging=true]:border-ring focus-within:border-border dark:border-muted-foreground/15 dark:focus-within:border-muted-foreground/30 flex w-full flex-col gap-2 rounded-(--composer-radius) border bg-(--composer-bg) p-(--composer-padding) shadow-[0_4px_16px_-8px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)] transition-[border-color,box-shadow] focus-within:shadow-[0_6px_24px_-8px_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.05)] data-[dragging=true]:border-dashed data-[dragging=true]:bg-[color-mix(in_oklab,var(--color-accent)_50%,var(--color-background))] dark:shadow-none"
      >
        <ComposerAttachments />
        <ComposerPrimitive.Input
          placeholder="请输入消息…"
          className="aui-composer-input caret-primary placeholder:text-muted-foreground/80 max-h-32 min-h-10 w-full resize-none bg-transparent px-2.5 py-1 text-base outline-none"
          rows={1}
          enterKeyHint="send"
          aria-label="消息输入框"
        />
        <ComposerAction />
      </div>
    </ComposerPrimitive.AttachmentDropzone>
  </ComposerPrimitive.Root>
);

const ComposerAction: FC = () => (
  <div className="aui-composer-action-wrapper relative flex items-center justify-between">
    <div className="flex items-center">
      <ComposerAddAttachment />
      <ComposerModelSelector />
    </div>
    <div className="flex items-center gap-1.5">
      <AuiIf condition={(state) => !state.thread.isRunning}>
        <ComposerPrimitive.Send asChild>
          <TooltipIconButton
            tooltip="发送消息"
            side="bottom"
            type="button"
            variant="default"
            size="icon"
            className="aui-composer-send size-7 rounded-full"
            aria-label="发送消息"
          >
            <ArrowUpIcon className="aui-composer-send-icon size-4.5" />
          </TooltipIconButton>
        </ComposerPrimitive.Send>
      </AuiIf>
      <AuiIf condition={(state) => state.thread.isRunning}>
        <StopButton
          type="button"
          variant="default"
          size="icon"
          className="aui-composer-cancel size-7 rounded-full"
          aria-label="停止生成"
        >
          <SquareIcon className="aui-composer-cancel-icon size-3.5 fill-current" />
        </StopButton>
      </AuiIf>
    </div>
  </div>
);

export function StopButton({
  children,
  className,
  ...props
}: ComponentProps<typeof Button>) {
  const aui = useAui();
  const runId = useAuiState(
    (state) => (state.thread.state as ApplicationState | null)?.runId,
  );

  const stopMutation = useMutation({
    mutationFn: (runId: string) =>
      agentCancelAgentRun({
        path: { run_id: runId },
        throwOnError: true,
      }),

    onSuccess: (_, runId) => {
      if (
        (aui.thread.getState().state as ApplicationState | null)?.runId ===
        runId
      ) {
        aui.thread.cancelRun();
      }

      toast.success("任务已停止");
    },

    onError: (error) => {
      toast.error(getApiErrorMessage(error, "任务停止失败，请再次点击停止"));
    },
  });

  return (
    <Button
      {...props}
      className={cn("relative", className)}
      disabled={!runId || stopMutation.isPending}
      aria-busy={stopMutation.isPending}
      onClick={() => {
        if (!runId || stopMutation.isPending) return;

        stopMutation.mutate(runId);
      }}
    >
      <ButtonLoading loading={stopMutation.isPending}>
        {children}
      </ButtonLoading>
    </Button>
  );
}

export const UserMessage: FC = () => (
  <MessagePrimitive.Root
    data-slot="aui_user-message-root"
    className="fade-in slide-in-from-bottom-1 animate-in grid auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] content-start gap-y-2 px-2 duration-150 [contain-intrinsic-size:auto_200px] [content-visibility:auto] [&:where(>*)]:col-start-2"
    data-role="user"
  >
    <UserMessageAttachments />

    <div className="aui-user-message-content-wrapper col-start-2 min-w-0">
      <div className="aui-user-message-content bg-muted text-foreground rounded-xl px-4 py-2 wrap-break-word empty:hidden">
        <MessagePrimitive.Parts />
      </div>
    </div>
  </MessagePrimitive.Root>
);
