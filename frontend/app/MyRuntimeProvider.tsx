"use client";

import {
  AssistantRuntimeProvider,
  type AssistantTransportConnectionMetadata,
  unstable_createMessageConverter as createMessageConverter,
  useAssistantTransportRuntime,
} from "@assistant-ui/react";
import {
  convertLangChainMessages,
  type LangChainMessage,
} from "@assistant-ui/react-langgraph";
import { clearAccessToken, getAccessToken } from "@/lib/auth";
import { type ReactNode, useRef } from "react";

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

  return {
    messages: LangChainMessageConverter.toThreadMessages(messages, isRunning),
    state: { todos: state.todos ?? [] } satisfies TodoState,
    isRunning,
  };
};

export function MyRuntimeProvider({ children }: MyRuntimeProviderProps) {
  const threadId = useRef<string | null>(null);
  const runtime = useAssistantTransportRuntime<State>({
    protocol: "assistant-transport",
    initialState: {
      messages: [],
    },
    api: "/api/chat",
    converter,
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
    prepareSendCommandsRequest: (body) => {
      if (threadId.current === null) {
        threadId.current = body.threadId ?? crypto.randomUUID();
      }

      return {
        ...body,
        threadId: threadId.current,
      };
    },
    onResponse: (response) => {
      if (response.status === 401) {
        clearAccessToken();
        window.location.assign("/login");
      }
    },
    onCancel: ({ updateState }) => {
      updateState((state) => {
        const lastMessage = state.messages.at(-1);

        if (lastMessage?.type !== "ai") {
          return state;
        }

        return {
          ...state,
          messages: [
            ...state.messages.slice(0, -1),
            {
              ...lastMessage,
              status: { type: "incomplete", reason: "cancelled" },
            },
          ],
        };
      });
    },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}
