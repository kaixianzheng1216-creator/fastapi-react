"use client";

import { Button } from "@/components/ui/button";
import { useAui, useAuiState } from "@assistant-ui/react";
import { ArchiveIcon, TrashIcon } from "lucide-react";

function useMainThreadTitle(fallback: string): string {
  return useAuiState((s) => {
    const mainThreadId = s.threads.mainThreadId;
    const item = s.threads.threadItems.find((item) => item.id === mainThreadId);
    return item?.title || fallback;
  });
}

export function ThreadHeader() {
  const aui = useAui();
  const title = useMainThreadTitle("新对话");

  function archive(): void {
    const mainThreadId = aui.threads().getState().mainThreadId;
    aui.threads().item({ id: mainThreadId }).archive();
  }

  function deleteThread(): void {
    const mainThreadId = aui.threads().getState().mainThreadId;
    aui.threads().item({ id: mainThreadId }).delete();
  }

  return (
    <header className="relative flex h-14 items-center justify-center border-b">
      <h1 className="max-w-96 truncate text-sm font-medium">{title}</h1>
      <div className="absolute end-3 flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={archive}>
          <ArchiveIcon className="size-4" />
          <span className="sr-only">归档</span>
        </Button>
        <Button variant="ghost" size="icon" onClick={deleteThread}>
          <TrashIcon className="size-4" />
          <span className="sr-only">删除</span>
        </Button>
      </div>
    </header>
  );
}
