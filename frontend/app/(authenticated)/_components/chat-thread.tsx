"use client";

import { MarkdownText, useCopyToClipboard } from "@/app/(authenticated)/_components/markdown-text";
import {
  Reasoning,
  ReasoningContent,
  ReasoningRoot,
  ReasoningText,
  ReasoningTrigger,
} from "@/app/(authenticated)/_components/reasoning";
import { ToolFallback } from "@/app/(authenticated)/_components/tool-fallback";
import {
  Composer,
  ComposerSkeleton,
  ChatConversationSkeleton,
  ThreadShell,
  ThreadStarterSuggestions,
  ThreadWelcome,
  UserMessage,
} from "@/app/(authenticated)/_components/thread-ui";
import { selectIsNewConversation } from "@/app/(authenticated)/_components/conversation-selectors";
import { TooltipIconButton } from "@/app/(authenticated)/_components/tooltip-icon-button";
import {
  ActionBarMorePrimitive,
  ActionBarPrimitive,
  ErrorPrimitive,
  groupPartByType,
  MessagePrimitive,
  ThreadPrimitive,
  useAuiState,
  useAui,
} from "@assistant-ui/react";
import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  MoreHorizontalIcon,
} from "lucide-react";
import type { FC } from "react";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import type { ApplicationState } from "@/lib/conversation-state";

export const ChatThread: FC = () => {
  const isEmpty = useAuiState(selectIsNewConversation);
  const isExisting = useAuiState(
    (s) =>
      !!s.threads.threadItems.find((item) => item.id === s.threads.mainThreadId)
        ?.remoteId,
  );
  const isLoading = useAuiState(
    (s) => !!(s.thread.state as ApplicationState | null)?.isLoading,
  );

  return (
    <ThreadShell
      isEmpty={isEmpty && !isLoading}
      maxWidth="52rem"
      footer={
        isLoading ? (
          <ComposerSkeleton />
        ) : (
          <>
            <Composer />
            <ThreadStarterSuggestions />
          </>
        )
      }
    >
      {isLoading && <ChatConversationSkeleton />}

      {isEmpty && !isLoading && isExisting && (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>暂无可显示内容</EmptyTitle>
          </EmptyHeader>
        </Empty>
      )}
      {isEmpty && !isLoading && !isExisting ? (
        <ThreadWelcome title="今天有什么可以帮你？" />
      ) : null}

      <div
        data-slot="aui_message-group"
        className="mb-14 flex flex-col gap-y-6 empty:hidden"
      >
        <ThreadPrimitive.Messages>
          {() => <ThreadMessage />}
        </ThreadPrimitive.Messages>
      </div>
    </ThreadShell>
  );
};

const ThreadMessage: FC = () => {
  const role = useAuiState((s) => s.message.role);

  if (role === "user") return <UserMessage />;

  return <AssistantMessage />;
};

const AssistantMessage: FC = () => {
  return (
    <MessagePrimitive.Root
      data-slot="aui_assistant-message-root"
      data-role="assistant"
      className="fade-in slide-in-from-bottom-1 animate-in relative -mb-7.5 pb-7.5 duration-150 [contain-intrinsic-size:auto_200px] [content-visibility:auto]"
    >
      <div
        data-slot="aui_assistant-message-content"
        className="text-foreground px-2 leading-relaxed wrap-break-word"
      >
        <MessagePrimitive.GroupedParts
          groupBy={groupPartByType({
            reasoning: ["group-chainOfThought", "group-reasoning"],
            "tool-call": ["group-chainOfThought", "group-tool"],
            "standalone-tool-call": [],
          })}
        >
          {({ part, children }) => {
            switch (part.type) {
              case "group-chainOfThought": {
                const isThinking = part.status.type === "running";

                return (
                  <ReasoningRoot streaming={isThinking}>
                    <ReasoningTrigger active={isThinking} />

                    <ReasoningContent aria-busy={isThinking}>
                      <ReasoningText>{children}</ReasoningText>
                    </ReasoningContent>
                  </ReasoningRoot>
                );
              }
              case "group-tool":
              case "group-reasoning":
                return children;
              case "text":
                return <MarkdownText />;
              case "reasoning":
                return <Reasoning {...part} />;
              case "tool-call":
                return part.toolUI ?? <ToolFallback {...part} />;
              case "data":
                return part.dataRendererUI;
              case "indicator":
                return (
                  <span
                    data-slot="aui_assistant-message-indicator"
                    className="animate-pulse font-sans"
                    aria-label="助手正在工作"
                  >
                    {"●"}
                  </span>
                );
              default:
                return null;
            }
          }}
        </MessagePrimitive.GroupedParts>

        <MessageError />
      </div>

      <div
        data-slot="aui_assistant-message-footer"
        className="ms-2 flex min-h-7.5 items-center pt-1.5"
      >
        <AssistantActionBar />
      </div>
    </MessagePrimitive.Root>
  );
};

const MessageError: FC = () => (
  <MessagePrimitive.Error>
    <ErrorPrimitive.Root className="aui-message-error-root text-muted-foreground mt-2 text-sm">
      <ErrorPrimitive.Message className="aui-message-error-message break-words" />
    </ErrorPrimitive.Root>
  </MessagePrimitive.Error>
);

const AssistantActionBar: FC = () => {
  const aui = useAui();
  const { isCopied, copyToClipboard } = useCopyToClipboard();
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="aui-assistant-action-bar-root text-muted-foreground animate-in fade-in col-start-3 row-start-2 -ms-1 flex gap-1 duration-200"
    >
      <TooltipIconButton
        tooltip={isCopied ? "已复制" : "复制"}
        onClick={() => copyToClipboard(aui.message.getCopyText())}
      >
        {isCopied ? <CheckIcon /> : <CopyIcon />}
      </TooltipIconButton>
      <ActionBarMorePrimitive.Root>
        <ActionBarMorePrimitive.Trigger asChild>
          <TooltipIconButton
            tooltip="更多"
            className="data-[state=open]:bg-accent"
          >
            <MoreHorizontalIcon />
          </TooltipIconButton>
        </ActionBarMorePrimitive.Trigger>
        <ActionBarMorePrimitive.Content
          side="bottom"
          align="start"
          sideOffset={6}
          className="aui-action-bar-more-content bg-popover/95 text-popover-foreground data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:animate-out data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[8rem] overflow-hidden rounded-xl border p-1.5 shadow-lg backdrop-blur-sm"
        >
          <ActionBarPrimitive.ExportMarkdown asChild>
            <ActionBarMorePrimitive.Item className="aui-action-bar-more-item hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm outline-none select-none">
              <DownloadIcon className="size-4" />
              导出为 Markdown
            </ActionBarMorePrimitive.Item>
          </ActionBarPrimitive.ExportMarkdown>
        </ActionBarMorePrimitive.Content>
      </ActionBarMorePrimitive.Root>
    </ActionBarPrimitive.Root>
  );
};
