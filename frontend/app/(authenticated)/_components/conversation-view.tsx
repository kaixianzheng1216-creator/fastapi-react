"use client";

import type { PropsWithChildren, ReactNode } from "react";

import { ChatThread } from "@/app/(authenticated)/_components/chat-thread";
import { selectIsNewConversation } from "@/app/(authenticated)/_components/conversation-selectors";
import { ResearchThread } from "@/app/(authenticated)/_components/research/research-thread";
import { useConversationKindState } from "@/app/conversation-kind";
import { LoadError } from "@/components/common/load-error";
import { Skeleton } from "@/components/ui/skeleton";
import type { ApplicationState } from "@/lib/conversation-state";
import { useMutation } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  AuiConfig,
  AuiProvider,
  Suggestions,
  useAui,
  useAuiState,
} from "@assistant-ui/react";

import { ConversationSidebar } from "@/app/(authenticated)/_components/conversation-sidebar";

const CHAT_AUI_CONFIG = AuiConfig({
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

const RESEARCH_AUI_CONFIG = AuiConfig({
  suggestions: Suggestions([
    {
      title: "调研 AI Agent 行业趋势",
      label: "",
      prompt: "请调研 AI Agent 行业的发展趋势、主要参与者和市场机会。",
    },
    {
      title: "分析新能源汽车市场",
      label: "",
      prompt: "请调研中国新能源汽车市场现状、竞争格局和未来发展趋势。",
    },
  ]),
});

type ConversationViewProps = {
  rightSidebarOpen: boolean;
  mobileRightSidebarOpen: boolean;
  onMobileRightSidebarOpenChange: (open: boolean) => void;
};

export function ConversationView(props: ConversationViewProps) {
  const aui = useAui();
  const { kind: conversationKind, isError, refetch } = useConversationKindState();
  const loadError = useAuiState(
    (state) => (state.thread.state as ApplicationState | null)?.loadError,
  );
  const retry = useMutation({
    mutationFn: async () => {
      const threadId = aui.threads.getState().mainThreadId;
      if (isError) await refetch({ throwOnError: true });
      if (loadError && aui.threads.getState().mainThreadId === threadId) {
        await aui.threads.reloadMainThread();
      }
    },
  });

  if (isError || loadError) {
    return (
      <LoadError
        className="h-full"
        title="暂时无法加载会话"
        onRetry={() => retry.mutate()}
        isRetrying={retry.isPending}
      />
    );
  }

  if (!conversationKind) {
    return (
      <div
        role="status"
        aria-label="正在加载会话类型"
        className="flex h-full items-center justify-center"
      >
        <Skeleton className="h-4 w-32" />
      </div>
    );
  }

  return conversationKind === "research" ? (
    <ResearchView />
  ) : (
    <ChatView {...props} />
  );
}

function ChatView({
  rightSidebarOpen,
  mobileRightSidebarOpen,
  onMobileRightSidebarOpenChange,
}: ConversationViewProps) {
  const aui = useAui();

  return (
    <AuiProvider extends={aui} config={CHAT_AUI_CONFIG}>
      <ConversationLayout
        sidebar={
          <ConversationSidebar
            open={rightSidebarOpen}
            mobileOpen={mobileRightSidebarOpen}
            onMobileOpenChange={onMobileRightSidebarOpenChange}
          />
        }
      >
        <ChatThread />
      </ConversationLayout>
    </AuiProvider>
  );
}

function ResearchView() {
  const aui = useAui();
  const isNewResearch = useAuiState(selectIsNewConversation);

  return (
    <AuiProvider extends={aui} config={RESEARCH_AUI_CONFIG}>
      <ConversationLayout wide={!isNewResearch}>
        <ResearchThread />
      </ConversationLayout>
    </AuiProvider>
  );
}

function ConversationLayout({
  wide = false,
  sidebar,
  children,
}: PropsWithChildren<{ wide?: boolean; sidebar?: ReactNode }>) {
  return (
    <div
      className={cn(
        "grid h-full min-h-0 grid-cols-1 grid-rows-[minmax(0,1fr)]",
        wide
          ? "2xl:grid-cols-[1fr_minmax(0,68rem)_1fr]"
          : "2xl:grid-cols-[1fr_minmax(0,52rem)_1fr]",
      )}
    >
      <div className="hidden 2xl:block" />
      <div className="min-h-0 min-w-0">{children}</div>
      {sidebar ?? <div className="hidden 2xl:block" />}
    </div>
  );
}
