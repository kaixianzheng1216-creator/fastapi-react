import type { AssistantState } from "@assistant-ui/react";

export const selectIsNewConversation = (state: AssistantState) =>
  state.thread.messages.length === 0 &&
  (!state.thread.isLoading || state.threads.isLoading);
