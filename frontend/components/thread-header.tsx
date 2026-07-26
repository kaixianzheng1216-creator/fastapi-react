"use client";

import { ThreadListItemMore } from "@/components/thread-list";
import { ThreadListItemPrimitive } from "@assistant-ui/react";

export function ThreadHeader() {
  return (
    <header className="relative flex h-14 items-center justify-center border-b">
      <h1 className="max-w-96 truncate text-sm font-medium">
        <ThreadListItemPrimitive.Title fallback="新对话" />
      </h1>
      <ThreadListItemMore
        sharedFocusGroup={false}
        side="bottom"
        align="end"
        triggerClassName="absolute end-3"
      />
    </header>
  );
}
