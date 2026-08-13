"use client";

import { ConversationSidebar } from "@/components/conversation-sidebar";
import { SkillBrowser } from "@/components/skill-browser";
import { Thread } from "@/components/thread";
import { ThreadHeader } from "@/components/thread-header";
import { ThreadListPopover } from "@/components/thread-list-popover";
import { ThreadListSidebar } from "@/components/threadlist-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getAccessToken } from "@/lib/auth";
import { useAui, AuiProvider, Suggestions } from "@assistant-ui/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MyRuntimeProvider } from "./MyRuntimeProvider";

function ThreadWithSuggestions() {
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
        <ConversationSidebar />
      </div>
    </AuiProvider>
  );
}

export default function Home() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [activeView, setActiveView] = useState<"conversation" | "skills">(
    "conversation",
  );

  useEffect(() => {
    if (getAccessToken()) {
      setAuthenticated(true);

      return;
    }

    router.replace("/login");
  }, [router]);

  if (!authenticated) {
    return null;
  }

  return (
    <MyRuntimeProvider>
      <SidebarProvider defaultOpen className="h-full min-h-0">
        <ThreadListSidebar
          activeView={activeView}
          onShowConversation={() => setActiveView("conversation")}
          onShowSkills={() => setActiveView("skills")}
        />
        <SidebarInset className="min-h-0">
          {activeView === "conversation" ? (
            <>
              <ThreadHeader />
              <ThreadListPopover />
              <div className="min-h-0 flex-1">
                <ThreadWithSuggestions />
              </div>
            </>
          ) : (
            <>
              <header className="flex h-14 items-center justify-center border-b">
                <h1 className="text-sm font-medium">Skills</h1>
              </header>
              <ThreadListPopover
                onShowConversation={() => setActiveView("conversation")}
              />
              <SkillBrowser />
            </>
          )}
        </SidebarInset>
      </SidebarProvider>
    </MyRuntimeProvider>
  );
}
