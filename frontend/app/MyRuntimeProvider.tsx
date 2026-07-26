"use client";

import {
  AssistantRuntimeProvider,
  type AssistantTransportConnectionMetadata,
  unstable_createMessageConverter as createMessageConverter,
  useAui,
  useAuiState,
  useAssistantTransportRuntime,
  useRemoteThreadListRuntime,
} from "@assistant-ui/react";
import {
  convertLangChainMessages,
  type LangChainMessage,
} from "@assistant-ui/react-langgraph";
import { clearAccessToken, getAccessToken } from "@/lib/auth";
import {
  conversationThreadListAdapter,
  generateConversationTitle,
  readConversationState,
} from "@/lib/conversation-thread-list-adapter";
import { type ReactNode, useEffect } from "react";

type MyRuntimeProviderProps = {
  children: ReactNode;
};

export type Todo = {
  content: string;
  status: "pending" | "in_progress" | "completed";
};

export type TodoState = {
  todos?: Todo[];
};

export type State = TodoState & {
  messages: LangChainMessage[];
  cancelledToolCallIds?: string[];
};

const convertDeepSeekMessage: typeof convertLangChainMessages = (
  message,
  metadata,
) => {
  if (message.type !== "ai") {
    return convertLangChainMessages(message, metadata);
  }

  const additionalKwargs = message.additional_kwargs;
  const reasoningContent =
    additionalKwargs && "reasoning_content" in additionalKwargs
      ? additionalKwargs.reasoning_content
      : undefined;

  if (typeof reasoningContent !== "string" || !reasoningContent) {
    return convertLangChainMessages(message, metadata);
  }

  return convertLangChainMessages(
    {
      ...message,
      additional_kwargs: {
        ...additionalKwargs,
        reasoning: {
          type: "reasoning",
          reasoning: reasoningContent,
        },
      },
    },
    metadata,
  );
};

const LangChainMessageConverter = createMessageConverter(
  convertDeepSeekMessage,
);

const converter = (
  state: State,
  connectionMetadata: AssistantTransportConnectionMetadata,
) => {
  const optimisticStateMessages = connectionMetadata.pendingCommands.map(
    (c): LangChainMessage[] => {
      if (c.type === "add-message") {
        return [
          {
            type: "human" as const,
            content: [
              {
                type: "text" as const,
                text: c.message.parts
                  .map((p) => (p.type === "text" ? p.text : ""))
                  .join("\n"),
              },
            ],
          },
        ];
      }
      return [];
    },
  );

  const messages = [...state.messages, ...optimisticStateMessages.flat()];
  const isRunning = connectionMetadata.isSending || false;
  const threadMessages = LangChainMessageConverter.toThreadMessages(
    messages,
    isRunning,
  );
  const cancelledToolCallIds = new Set(state.cancelledToolCallIds);

  return {
    messages: threadMessages.map((message) => {
      if (
        message.role === "assistant" &&
        message.content.some(
          (part) =>
            part.type === "tool-call" &&
            cancelledToolCallIds.has(part.toolCallId),
        )
      ) {
        return {
          ...message,
          status: { type: "incomplete" as const, reason: "cancelled" as const },
        };
      }

      return message;
    }),
    state: { todos: state.todos ?? [] } satisfies TodoState,
    isRunning,
  };
};

export function MyRuntimeProvider({ children }: MyRuntimeProviderProps) {
  const runtime = useRemoteThreadListRuntime({
    adapter: conversationThreadListAdapter,
    runtimeHook: useConversationRuntime,
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}

function useConversationRuntime() {
  const aui = useAui();
  const remoteId = useAuiState((state) =>
    state.threadListItem.custom?.persisted
      ? state.threadListItem.remoteId
      : undefined,
  );
  const runtime = useAssistantTransportRuntime<State>({
    protocol: "assistant-transport",
    initialState: {
      messages: [],
    },
    api: "/api/chat",
    converter,
    prepareSendCommandsRequest: async (body) => {
      const isFirstMessage = !body.threadId;
      const { remoteId } = await aui.threadListItem().initialize();

      if (isFirstMessage) {
        const command = body.commands.find(
          (command) => command.type === "add-message",
        );

        if (command?.type === "add-message" && command.message.role === "user") {
          void generateConversationTitle(remoteId, [...command.message.parts])
            .then(() => aui.threads().reload())
            .catch(console.error);
        }
      }

      return { ...body, threadId: remoteId };
    },
    capabilities: {
      edit: true,
    },
    headers: async () => {
      const accessToken = getAccessToken();
      const headers: Record<string, string> = {};

      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      return headers;
    },
    onResponse: (response) => {
      if (response.status === 401) {
        clearAccessToken();
        window.location.assign("/login");
      }
    },
    onCancel: ({ updateState }) => {
      updateState((state) => {
        const toolCallIds = state.messages
          .findLast((message) => message.type === "ai")
          ?.tool_calls?.map((toolCall) => toolCall.id)
          .filter((id): id is string => Boolean(id));

        if (!toolCallIds?.length) return state;

        return {
          ...state,
          cancelledToolCallIds: [
            ...new Set([
              ...(state.cancelledToolCallIds ?? []),
              ...toolCallIds,
            ]),
          ],
        };
      });
    },
  });

  useEffect(() => {
    if (!remoteId) return;

    void readConversationState(remoteId).then((state) => {
      runtime.thread.importExternalState(state);
    });
  }, [remoteId, runtime]);

  return runtime;
}
