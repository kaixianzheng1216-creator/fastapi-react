"use client";

import { PanelLeftIcon, SquarePenIcon } from "lucide-react";
import { useState } from "react";
import { ThreadList, ThreadListNew } from "@/components/thread-list";
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { useSidebar } from "@/components/ui/sidebar";
import { useCurrentUser, UserProfile } from "@/components/user-info";

export function ThreadListPopover({
  onShowConversation,
}: {
  onShowConversation?: () => void;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const { open, setOpen } = useSidebar();
  const user = useCurrentUser();

  return (
    <div className="absolute top-3 left-3 flex gap-1">
      <HoverCard
        open={previewOpen && !open}
        onOpenChange={setPreviewOpen}
        openDelay={0}
      >
        <HoverCardTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
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
          className="flex max-h-[calc(100vh-28rem)] w-72 flex-col overflow-hidden p-2"
        >
          <div className="overflow-y-auto px-1" onClick={onShowConversation}>
            <ThreadList />
          </div>
          {user && (
            <div className="mt-2 flex items-center gap-2 border-t px-2 pt-2 text-sm">
              <UserProfile user={user} />
            </div>
          )}
        </HoverCardContent>
      </HoverCard>

      <ThreadListNew
        className="size-9 justify-center px-0 data-active:hidden"
        onClick={onShowConversation}
        aria-label="新对话"
      >
        <SquarePenIcon />
      </ThreadListNew>
    </div>
  );
}
