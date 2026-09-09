import type { AssistantState } from "@assistant-ui/react";

export const selectIsNewConversation = (state: AssistantState) =>
  state.threadListItem.status === "new" && state.thread.messages.length === 0;
