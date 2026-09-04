"use client";

import { ArtifactList } from "@/app/(authenticated)/_components/artifact-list";
import { TodoList } from "@/app/(authenticated)/_components/todo-list";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuiState } from "@assistant-ui/react";
import { useEffect } from "react";

type ConversationSidebarProps = {
  open: boolean;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
};

function ConversationOverview() {
  return (
    <Card className="gap-2 py-4">
      <TodoList />
      <Separator className="mx-6 my-2 w-auto" />
      <ArtifactList />
    </Card>
  );
}

export function ConversationSidebar({
  open,
  mobileOpen,
  onMobileOpenChange,
}: ConversationSidebarProps) {
  const hasStarted = useAuiState((state) => state.thread.messages.length > 0);

  useEffect(() => {
    if (!hasStarted && mobileOpen) {
      onMobileOpenChange(false);
    }
  }, [hasStarted, mobileOpen, onMobileOpenChange]);

  if (!hasStarted) return null;

  return (
    <>
      {open && (
        <aside
          aria-label="会话概览"
          className="hidden w-80 justify-self-end p-4 2xl:block"
        >
          <ConversationOverview />
        </aside>
      )}

      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent
          side="right"
          className="w-[min(22rem,calc(100%-1rem))] gap-4 overflow-y-auto p-4 2xl:hidden"
        >
          <SheetHeader className="px-0 pt-0 text-left">
            <SheetTitle>会话概览</SheetTitle>
            <SheetDescription>查看当前会话的待办和产物。</SheetDescription>
          </SheetHeader>
          <ConversationOverview />
        </SheetContent>
      </Sheet>
    </>
  );
}
