"use client";

import { PanelLeftIcon } from "lucide-react";
import { ThreadList } from "@/components/thread-list";
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { useSidebar } from "@/components/ui/sidebar";
import { useState } from "react";

export function ThreadListPopover() {
  const [previewOpen, setPreviewOpen] = useState(false);
  const { open, setOpen } = useSidebar();

  return (
    <HoverCard
      open={previewOpen && !open}
      onOpenChange={setPreviewOpen}
      openDelay={0}
    >
      <HoverCardTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-3 left-3"
          aria-label={open ? "收起会话列表" : "打开会话列表"}
          onClick={() => {
            setPreviewOpen(false);
            setOpen(!open);
          }}
        >
          <PanelLeftIcon />
        </Button>
      </HoverCardTrigger>
      <HoverCardContent
        align="start"
        side="bottom"
        className="max-h-[calc(100vh-4rem)] overflow-y-auto p-2"
      >
        <ThreadList />
      </HoverCardContent>
    </HoverCard>
  );
}
