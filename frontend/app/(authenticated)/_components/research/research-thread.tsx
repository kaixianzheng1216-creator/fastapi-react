"use client";

import {
  Composer,
  ThreadShell,
  ThreadWelcome,
  UserMessage,
} from "@/app/(authenticated)/_components/thread-shared";
import { isNewConversationView } from "@/app/(authenticated)/_components/thread-state";
import { Button } from "@/components/ui/button";
import type { ResearchState } from "@/lib/conversation-state";
import {
  ComposerPrimitive,
  ThreadPrimitive,
  useAuiState,
} from "@assistant-ui/react";
import { SquareIcon } from "lucide-react";

import { ResearchProgress } from "./research-progress";

export function ResearchThread() {
  const isEmpty = useAuiState(isNewConversationView);

  return (
    <ThreadShell
      isEmpty={isEmpty}
      maxWidth={isEmpty ? "52rem" : "68rem"}
      footer={isEmpty ? <Composer /> : <ResearchCancel />}
    >
      {isEmpty ? <ThreadWelcome title="开始一项新调研" /> : null}

      <div className="mb-6 flex flex-col gap-y-6 empty:hidden">
        <ThreadPrimitive.Messages>
          {({ message }) =>
            message.role === "user" ? <UserMessage /> : null
          }
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
    <ComposerPrimitive.Cancel asChild>
      <Button type="button" variant="outline" className="mx-auto rounded-full">
        <SquareIcon
          data-icon="inline-start"
          className="fill-current"
          aria-hidden="true"
        />
        停止调研
      </Button>
    </ComposerPrimitive.Cancel>
  );
}
