"use client";

import { AppHeader } from "@/components/layout/app-header";
import { ThreadListItemMore } from "@/app/(authenticated)/_components/thread-list";
import { ThreadListPopover } from "@/app/(authenticated)/_components/thread-list-popover";
import { Button } from "@/components/ui/button";
import { useAuiState } from "@assistant-ui/react";
import { Columns2Icon } from "lucide-react";

function useMainThreadTitle(fallback: string): string {
  return useAuiState((s) => {
    const mainThreadId = s.threads.mainThreadId;
    const item = s.threads.threadItems.find((item) => item.id === mainThreadId);
    return item?.title || fallback;
  });
}

function useMainThreadInitialized(): boolean {
  return useAuiState((state) => {
    const mainThreadId = state.threads.mainThreadId;
    const item = state.threads.threadItems.find(
      (item) => item.id === mainThreadId,
    );
    return item?.remoteId !== undefined;
  });
}

export function ThreadHeader({
  sidebarOpen,
  onSidebarOpenChange,
  onMobileSidebarOpen,
}: {
  sidebarOpen: boolean;
  onSidebarOpenChange: (open: boolean) => void;
  onMobileSidebarOpen: () => void;
}) {
  const title = useMainThreadTitle("新对话");
  const isInitialized = useMainThreadInitialized();
  const hasStarted = useAuiState((state) => state.thread.messages.length > 0);

  return (
    <AppHeader
      title={title}
      left={<ThreadListPopover />}
      actions={
        <div className="flex items-center">
          <ThreadListItemMore
            disabled={!isInitialized}
            sharedFocusGroup={false}
            side="bottom"
            align="end"
            triggerClassName="shrink-0"
          />
          <Button
            variant="ghost"
            size="icon"
            className="2xl:hidden"
            disabled={!hasStarted}
            aria-label="打开会话概览"
            onClick={onMobileSidebarOpen}
          >
            <Columns2Icon aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hidden 2xl:inline-flex"
            disabled={!hasStarted}
            aria-label={sidebarOpen ? "收起会话侧栏" : "展开会话侧栏"}
            onClick={() => onSidebarOpenChange(!sidebarOpen)}
          >
            <Columns2Icon aria-hidden="true" />
          </Button>
        </div>
      }
    />
  );
}
