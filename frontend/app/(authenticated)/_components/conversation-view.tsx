"use client";

import dynamic from "next/dynamic";
import type { PropsWithChildren, ReactNode } from "react";

import { isNewConversationView } from "@/app/(authenticated)/_components/thread-state";
import { useConversationKind } from "@/app/conversation-kind";
import { cn } from "@/lib/utils";
import {
  AuiProvider,
  Suggestions,
  useAui,
  useAuiState,
} from "@assistant-ui/react";

const ChatThread = dynamic(() =>
  import("@/app/(authenticated)/_components/chat-thread").then(
    (module) => module.ChatThread,
  ),
);
const ConversationSidebar = dynamic(() =>
  import("@/app/(authenticated)/_components/conversation-sidebar").then(
    (module) => module.ConversationSidebar,
  ),
);
const ResearchThread = dynamic(() =>
  import("@/app/(authenticated)/_components/research/research-thread").then(
    (module) => module.ResearchThread,
  ),
);

type ConversationViewProps = {
  sidebarOpen: boolean;
  mobileSidebarOpen: boolean;
  onMobileSidebarOpenChange: (open: boolean) => void;
};

const CHAT_SUGGESTIONS = Suggestions([
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
]);

export function ConversationView(props: ConversationViewProps) {
  const kind = useConversationKind();

  return kind === "research" ? <ResearchView /> : <ChatView {...props} />;
}

function ChatView({
  sidebarOpen,
  mobileSidebarOpen,
  onMobileSidebarOpenChange,
}: ConversationViewProps) {
  const aui = useAui({ suggestions: CHAT_SUGGESTIONS });

  return (
    <AuiProvider value={aui}>
      <ConversationLayout
        columns="2xl:grid-cols-[1fr_minmax(0,52rem)_1fr]"
        sidebar={
          <ConversationSidebar
            open={sidebarOpen}
            mobileOpen={mobileSidebarOpen}
            onMobileOpenChange={onMobileSidebarOpenChange}
          />
        }
      >
        <ChatThread />
      </ConversationLayout>
    </AuiProvider>
  );
}

function ResearchView() {
  const isEmpty = useAuiState(isNewConversationView);

  return (
    <ConversationLayout
      columns={
        isEmpty
          ? "2xl:grid-cols-[1fr_minmax(0,52rem)_1fr]"
          : "2xl:grid-cols-[1fr_minmax(0,68rem)_1fr]"
      }
    >
      <ResearchThread />
    </ConversationLayout>
  );
}

function ConversationLayout({
  columns,
  sidebar,
  children,
}: PropsWithChildren<{ columns: string; sidebar?: ReactNode }>) {
  return (
    <div
      className={cn(
        "grid h-full min-h-0 grid-cols-1 grid-rows-[minmax(0,1fr)]",
        columns,
      )}
    >
      <div className="hidden 2xl:block" />
      <div className="min-h-0 min-w-0">{children}</div>
      {sidebar ?? <div className="hidden 2xl:block" />}
    </div>
  );
}
