"use client";

import { useState } from "react";

import { ConversationSidebar } from "@/components/conversation-sidebar";
import { Thread } from "@/components/thread";
import { ThreadHeader } from "@/components/thread-header";
import { AuiProvider, Suggestions, useAui } from "@assistant-ui/react";

function ThreadWithSuggestions({ sidebarOpen }: { sidebarOpen: boolean }) {
  const aui = useAui({
    suggestions: Suggestions([
      {
        title: "厦门今天天气怎么样？",
        label: "",
        prompt: "厦门今天天气怎么样？",
      },
      {
        title: "介绍一下你自己以及你的能力",
        label: "",
        prompt: "你能帮助我做什么？",
      },
    ]),
  });

  return (
    <AuiProvider value={aui}>
      <div className="grid h-full min-h-0 grid-cols-1 grid-rows-[minmax(0,1fr)] 2xl:grid-cols-[1fr_minmax(0,52rem)_1fr]">
        <div className="hidden 2xl:block" />
        <div className="min-h-0 min-w-0">
          <Thread />
        </div>
        <ConversationSidebar open={sidebarOpen} />
      </div>
    </AuiProvider>
  );
}

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <>
      <ThreadHeader
        sidebarOpen={sidebarOpen}
        onSidebarOpenChange={setSidebarOpen}
      />
      <div className="min-h-0 flex-1">
        <ThreadWithSuggestions sidebarOpen={sidebarOpen} />
      </div>
    </>
  );
}
