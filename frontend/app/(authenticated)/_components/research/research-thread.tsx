"use client";

import {
  Composer,
  ResearchConversationSkeleton,
  StopButton,
  ThreadShell,
  ThreadStarterSuggestions,
  ThreadWelcome,
  UserMessage,
} from "@/app/(authenticated)/_components/thread-ui";
import { selectIsNewConversation } from "@/app/(authenticated)/_components/conversation-selectors";
import type { ResearchState } from "@/lib/conversation-state";
import {
  ThreadPrimitive,
  useAuiState,
} from "@assistant-ui/react";
import { SquareIcon } from "lucide-react";

import { ResearchProgress } from "./research-progress";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

export function ResearchThread() {
  const isEmpty = useAuiState(selectIsNewConversation);
  const isExisting = useAuiState(
    (s) =>
      !!s.threads.threadItems.find((item) => item.id === s.threads.mainThreadId)
        ?.remoteId,
  );
  const isLoading = useAuiState(
    (s) => !!(s.thread.state as ResearchState | null)?.isLoading,
  );

  return (
    <ThreadShell
      isEmpty={isEmpty && !isLoading}
      maxWidth={isEmpty && !isLoading ? "52rem" : "68rem"}
      scrollToBottomOnLoad={false}
      footer={
        isLoading ? null : isEmpty ? (
          <>
            <Composer />
            <ThreadStarterSuggestions />
          </>
        ) : (
          <ResearchCancel />
        )
      }
    >
      {isLoading && <ResearchConversationSkeleton />}
      {isEmpty &&
        !isLoading &&
        (isExisting ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>暂无可显示内容</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : (
          <ThreadWelcome title="开始一项新调研" />
        ))}

      <div className="mb-6 flex flex-col gap-y-6 empty:hidden">
        <ThreadPrimitive.Messages>
          {({ message }) => (message.role === "user" ? <UserMessage /> : null)}
        </ThreadPrimitive.Messages>
      </div>

      <ResearchProgress />
    </ThreadShell>
  );
}

function ResearchCancel() {
  const isRunning = useAuiState((state) => {
    const runStatus = (state.thread.state as ResearchState | null)?.runStatus;

    return (
      state.thread.isRunning &&
      runStatus !== "completed" &&
      runStatus !== "failed" &&
      runStatus !== "cancelled"
    );
  });

  if (!isRunning) return null;

  return (
    <StopButton type="button" variant="outline" className="mx-auto rounded-full">
      <SquareIcon
        data-icon="inline-start"
        className="fill-current"
        aria-hidden="true"
      />
      停止调研
    </StopButton>
  );
}
