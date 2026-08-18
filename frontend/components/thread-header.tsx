"use client";

import { AppHeader } from "@/components/app-header";
import { ThreadListItemMore } from "@/components/thread-list";
import { useAuiState } from "@assistant-ui/react";

function useMainThreadTitle(fallback: string): string {
  return useAuiState((s) => {
    const mainThreadId = s.threads.mainThreadId;
    const item = s.threads.threadItems.find((item) => item.id === mainThreadId);
    return item?.title || fallback;
  });
}

function useMainThreadPersisted(): boolean {
  return useAuiState((state) => {
    const mainThreadId = state.threads.mainThreadId;
    const item = state.threads.threadItems.find(
      (item) => item.id === mainThreadId,
    );
    return item?.custom?.persisted === true;
  });
}

export function ThreadHeader() {
  const title = useMainThreadTitle("新对话");
  const isPersisted = useMainThreadPersisted();

  return (
    <AppHeader
      title={title}
      actions={
        <ThreadListItemMore
          disabled={!isPersisted}
          sharedFocusGroup={false}
          side="bottom"
          align="end"
          triggerClassName="shrink-0"
        />
      }
    />
  );
}
