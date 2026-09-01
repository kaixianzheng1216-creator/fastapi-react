"use client";

import {
  AssistantRuntimeProvider,
  type AssistantTransportConnectionMetadata,
  type CompleteAttachment,
  type FileMessagePart,
  type LanguageModelConfig,
  type ThreadUserMessagePart,
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
import { RESUMABLE_STREAM_ID_HEADER } from "assistant-stream/resumable";
import { type ReactNode, useEffect, useMemo, useRef } from "react";

import { clearAccessToken, getAccessToken } from "@/lib/auth";
import { agentCancelAgentRun } from "@/lib/client";
import {
  conversationThreadListAdapter,
  readConversationState,
} from "@/lib/conversation-thread-list-adapter";
import { createFileAttachmentTransport } from "@/lib/file-upload-adapter";

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

export type Artifact = {
  name: string;
  url: string;
  contentType: string;
};

export type ArtifactState = {
  artifacts?: Artifact[];
};

export type State = TodoState & ArtifactState & {
  messages: LangChainMessage[];
  cancelledToolCallIds?: string[];
};

const LangChainMessageConverter = createMessageConverter(
  convertLangChainMessages,
);

const converter = (
  state: State,
  connectionMetadata: AssistantTransportConnectionMetadata,
  stagedFiles: readonly FileMessagePart[],
) => {
  const pendingMessages = connectionMetadata.pendingCommands.filter(
    (command) => command.type === "add-message",
  );

  const optimisticStateMessages: LangChainMessage[] = pendingMessages.map(
    (command) => ({
      type: "human",
      content: [
        ...command.message.parts.map((part) =>
          part.type === "text"
            ? { type: "text" as const, text: part.text }
            : {
                type: "image_url" as const,
                image_url: { url: part.image },
              },
        ),
        ...stagedFiles.map((part) => ({
          type: "file" as const,
          url: part.data,
          mime_type: part.mimeType,
          source_type: "url" as const,
          metadata: { filename: part.filename },
        })),
      ],
    }),
  );

  const messages = [...state.messages, ...optimisticStateMessages];

  const isRunning = connectionMetadata.isSending;

  const threadMessages = LangChainMessageConverter.toThreadMessages(
    messages,
    isRunning,
  ).map((message) => {
    if (message.role !== "user") return message;

    const attachmentParts = message.content.filter(
      (
        part,
      ): part is Extract<ThreadUserMessagePart, { type: "file" | "image" }> =>
        part.type === "file" || part.type === "image",
    );

    if (attachmentParts.length === 0) return message;

    const attachments: CompleteAttachment[] = attachmentParts.map(
      (part, index) => {
        return {
          id: `${message.id}:${index}`,
          type: part.type === "image" ? "image" : "document",
          name: part.filename ?? (part.type === "image" ? "图片" : "文件"),
          contentType: part.type === "file" ? part.mimeType : undefined,
          status: { type: "complete" },
          content: [part],
        };
      },
    );

    return {
      ...message,
      content: message.content.filter(
        (part) => part.type !== "file" && part.type !== "image",
      ),
      attachments: [...message.attachments, ...attachments],
    };
  });

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
    state: {
      todos: state.todos ?? [],
      artifacts: state.artifacts ?? [],
    } satisfies TodoState & ArtifactState,
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
  const fileTransport = useMemo(createFileAttachmentTransport, []);
  const activeRunId = useRef<string | null>(null);
  const cancelledRunId = useRef<string | null>(null);
  const resumedThreadId = useRef<string | null>(null);

  const remoteId = useAuiState((state) =>
    state.threadListItem.custom?.persisted
      ? state.threadListItem.remoteId
      : undefined,
  );

  const runtime = useAssistantTransportRuntime<State>({
    protocol: "assistant-transport",
    initialState: { messages: [] },
    api: "/api/agent/runs",
    resumeApi: "/api/agent/runs/resume",
    resumeStateApi: "/api/agent/runs/resume-state",
    converter: (state, connectionMetadata) =>
      converter(state, connectionMetadata, fileTransport.getFilesForRequest()),
    adapters: { attachments: fileTransport.attachmentAdapter },
    prepareSendCommandsRequest: async (body) => {
      const { remoteId } = await aui.threadListItem.initialize();

      resumedThreadId.current = remoteId;

      const modelConfig = body.config as LanguageModelConfig | undefined;

      const request = {
        ...fileTransport.prepareRequest({
          ...body,
          threadId: remoteId,
        }),
      };

      delete request.config;
      delete request.modelName;
      delete request.reasoningEffort;

      return {
        ...request,
        model: modelConfig?.modelName,
        thinkingEnabled: modelConfig?.reasoningEffort === "enabled",
      };
    },
    capabilities: { edit: true },
    headers: async () => {
      const accessToken = getAccessToken();
      const headers: Record<string, string> = {};

      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

      return headers;
    },
    onResponse: (response) => {
      const responseRunId = response.headers.get(RESUMABLE_STREAM_ID_HEADER);

      if (responseRunId) {
        activeRunId.current = responseRunId;
        cancelledRunId.current = null;
      }

      if (response.status === 401) {
        clearAccessToken();
        window.location.assign("/login");
      }
    },
    onFinish: () => {
      if (activeRunId.current !== cancelledRunId.current) {
        activeRunId.current = null;
      }

      fileTransport.complete();
    },
    onError: fileTransport.discard,
    onCancel: ({ updateState, error }) => {
      if (!error) {
        void fileTransport.discard();

        const runId = activeRunId.current;

        cancelledRunId.current = runId;

        if (runId) {
          void agentCancelAgentRun({
            path: { run_id: runId },
            throwOnError: true,
          })
            .then(() => {
              if (activeRunId.current === runId) activeRunId.current = null;
              if (cancelledRunId.current === runId) cancelledRunId.current = null;
            })
            .catch((cancelError: unknown) => {
              console.error("取消 Agent 运行失败", cancelError);
            });
        }
      }

      updateState((state) => {
        const toolCallIds = state.messages
          .findLast((message) => message.type === "ai")
          ?.tool_calls?.map((toolCall) => toolCall.id)
          .filter((id): id is string => Boolean(id));

        if (!toolCallIds?.length) return state;

        return {
          ...state,
          cancelledToolCallIds: [
            ...new Set([...(state.cancelledToolCallIds ?? []), ...toolCallIds]),
          ],
        };
      });
    },
  });

  useEffect(() => {
    if (!remoteId) return;

    let isCurrent = true;

    void readConversationState(remoteId)
      .then((state) => {
        if (!isCurrent) return;

        runtime.thread.importExternalState(state);

        if (resumedThreadId.current !== remoteId) {
          resumedThreadId.current = remoteId;
          runtime.thread.resumeRun({ parentId: null });
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) console.error("读取会话状态失败", error);
      });

    return () => {
      isCurrent = false;
    };
  }, [remoteId, runtime]);

  return runtime;
}
