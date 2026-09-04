"use client";

import { useState } from "react";

import { ConversationView } from "@/app/(authenticated)/_components/conversation-view";
import { ThreadHeader } from "@/app/(authenticated)/_components/thread-header";

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <>
      <ThreadHeader
        sidebarOpen={sidebarOpen}
        onSidebarOpenChange={setSidebarOpen}
        onMobileSidebarOpen={() => setMobileSidebarOpen(true)}
      />
      <div className="min-h-0 flex-1">
        <ConversationView
          sidebarOpen={sidebarOpen}
          mobileSidebarOpen={mobileSidebarOpen}
          onMobileSidebarOpenChange={setMobileSidebarOpen}
        />
      </div>
    </>
  );
}
