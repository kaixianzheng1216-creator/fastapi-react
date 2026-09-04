"use client";

import { useAuiState } from "@assistant-ui/react";
import { createContext, useContext } from "react";
import type { ConversationKind } from "@/lib/client";

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

export function useConversationKind(): ConversationKind {
  const newConversationKind = useNewConversationKind().kind;

  const savedKind = useAuiState(
    (state) => state.threadListItem.custom?.kind as ConversationKind | undefined,
  );

  return savedKind ?? newConversationKind;
}
