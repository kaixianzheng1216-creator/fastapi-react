"use client";

import { useState } from "react";

import { ConversationView } from "@/app/(authenticated)/_components/conversation-view";
import { ThreadHeader } from "@/app/(authenticated)/_components/thread-header";

export default function Home() {
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const [mobileRightSidebarOpen, setMobileRightSidebarOpen] = useState(false);

  return (
    <>
      <ThreadHeader
        rightSidebarOpen={rightSidebarOpen}
        onRightSidebarOpenChange={setRightSidebarOpen}
        onMobileRightSidebarOpen={() => setMobileRightSidebarOpen(true)}
      />
      <div className="min-h-0 flex-1">
        <ConversationView
          rightSidebarOpen={rightSidebarOpen}
          mobileRightSidebarOpen={mobileRightSidebarOpen}
          onMobileRightSidebarOpenChange={setMobileRightSidebarOpen}
        />
      </div>
    </>
  );
}
