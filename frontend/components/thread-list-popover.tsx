"use client";

import { SquarePenIcon } from "lucide-react";
import { useState } from "react";
import { ThreadList, ThreadListNew } from "@/components/thread-list";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { useCurrentUser, UserProfile } from "@/components/user-info";

export function ThreadListPopover() {
  const [previewOpen, setPreviewOpen] = useState(false);
  const { open } = useSidebar();
  const user = useCurrentUser();

  return (
    <div className="flex gap-1">
      <HoverCard
        open={previewOpen && !open}
        onOpenChange={setPreviewOpen}
        openDelay={0}
      >
        <HoverCardTrigger asChild>
          <SidebarTrigger
            className="size-9"
            aria-label={open ? "收起会话列表" : "打开会话列表"}
            onClick={() => setPreviewOpen(false)}
          />
        </HoverCardTrigger>
        <HoverCardContent
          align="start"
          className="flex max-h-[calc(100vh-28rem)] w-72 flex-col overflow-hidden p-2"
        >
          <div className="overflow-y-auto px-1">
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
        className="size-9 justify-center data-[active=true]:hidden"
        aria-label="新对话"
      >
        <SquarePenIcon />
      </ThreadListNew>
    </div>
  );
}
