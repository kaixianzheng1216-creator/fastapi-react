"use client";

import { ThreadListItemMore } from "@/components/thread-list";
import { useAuiState } from "@assistant-ui/react";

function useMainThreadTitle(fallback: string): string {
  return useAuiState((s) => {
    const mainThreadId = s.threads.mainThreadId;
    const item = s.threads.threadItems.find((item) => item.id === mainThreadId);
    return item?.title || fallback;
  });
}

export function ThreadHeader() {
  const title = useMainThreadTitle("新对话");

  return (
    <header className="relative flex h-14 items-center justify-center border-b">
      <h1 className="max-w-96 truncate text-sm font-medium">{title}</h1>
      <ThreadListItemMore
        sharedFocusGroup={false}
        side="bottom"
        align="end"
        triggerClassName="absolute end-3"
      />
    </header>
  );
}
