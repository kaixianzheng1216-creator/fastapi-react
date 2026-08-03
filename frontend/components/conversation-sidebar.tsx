"use client";

import { ArtifactList } from "@/components/artifact-list";
import { TodoList } from "@/components/todo-list";
import { Card } from "@/components/ui/card";
import { useAuiState } from "@assistant-ui/react";

export function ConversationSidebar() {
  const hasStarted = useAuiState((state) => state.thread.messages.length > 0);

  if (!hasStarted) return null;

  return (
    <aside className="hidden w-80 justify-self-end p-4 2xl:block">
      <Card className="gap-2 py-4">
        <TodoList />
        <div className="mx-6 my-2 border-t" />
        <ArtifactList />
      </Card>
    </aside>
  );
}
