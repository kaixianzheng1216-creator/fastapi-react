"use client";

import { useAuiState } from "@assistant-ui/react";
import { createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";

import type { ConversationKind } from "@/lib/client";
import { conversationKindQueryOptions } from "@/lib/conversation-thread-list-adapter";

export type { ConversationKind } from "@/lib/client";

type NewConversationKind = {
  kind: ConversationKind;
  select: (kind: ConversationKind) => void;
};

export const NewConversationKindContext =
  createContext<NewConversationKind | null>(null);

export function useNewConversationKind() {
  const context = useContext(NewConversationKindContext);

  if (!context) {
    throw new Error(
      "useNewConversationKind must be used within NewConversationKindContext.Provider",
    );
  }

  return context;
}

export function useConversationKind(): ConversationKind | undefined {
  return useConversationKindState().kind;
}

export function useConversationKindState() {
  const newConversationKind = useNewConversationKind().kind;
  const id = useAuiState(
    (state) => state.threadListItem.remoteId ?? state.threadListItem.id,
  );
  const remoteId = useAuiState((state) => state.threadListItem.remoteId);
  const isNew = useAuiState((state) => state.threadListItem.status === "new");
  const query = useQuery({
    ...conversationKindQueryOptions(id),
    enabled: !!remoteId,
    meta: { handlesInitialError: true },
  });

  return {
    kind: isNew ? newConversationKind : query.data,
    isError: query.isError,
    refetch: query.refetch,
  };
}
