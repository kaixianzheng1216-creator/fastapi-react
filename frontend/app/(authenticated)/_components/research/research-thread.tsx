"use client";

import {
  Composer,
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
import { Skeleton } from "@/components/ui/skeleton";

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

function ResearchConversationSkeleton() {
  return (
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
              <div
                key={stage}
                className="flex h-14 items-center gap-3 border-b"
              >
                <Skeleton className="size-4 rounded-sm" />
                <Skeleton
                  className={index === 1 ? "h-4 w-24" : "h-4 w-20"}
                />
                <Skeleton className="ms-auto h-5 w-14 rounded-full" />
              </div>
            ),
          )}
        </div>
      </section>
    </div>
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
