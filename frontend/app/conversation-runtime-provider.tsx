"use client";

import {
  AssistantRuntimeProvider,
  type AssistantTransportConnectionMetadata,
  type CompleteAttachment,
  type FileMessagePart,
  type LanguageModelConfig,
  type ThreadMessage,
  type ThreadUserMessagePart,
  unstable_createMessageConverter as createMessageConverter,
  useAssistantTransportRuntime,
  useAui,
  useRemoteThreadListRuntime,
} from "@assistant-ui/react";
import {
  convertLangChainMessages,
  type LangChainMessage,
} from "@assistant-ui/react-langgraph";
import { RESUMABLE_STREAM_ID_HEADER } from "assistant-stream/resumable";
import type { ReadonlyJSONObject } from "assistant-stream/utils";
import {
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import {
  type ConversationKind,
  NewConversationKindContext,
} from "@/app/conversation-kind";
import { getApiErrorMessage } from "@/lib/api-error";
import { getAccessToken, handleUnauthorizedResponse } from "@/lib/auth";
import { type ConversationStatePublic } from "@/lib/client";
import type { ApplicationState } from "@/lib/conversation-state";
import {
  createConversationThreadListAdapter,
  readConversationState,
} from "@/lib/conversation-thread-list-adapter";
import { createFileAttachmentTransport } from "@/lib/file-upload-adapter";

type ConversationRuntimeProviderProps = {
  children: ReactNode;
};

type AgentState = Partial<
  Omit<ConversationStatePublic, "messages" | "researchMessages">
> & {
  kind?: ConversationKind;
  messages: LangChainMessage[];
  researchMessages?: LangChainMessage[];
};

export function ConversationRuntimeProvider({
  children,
}: ConversationRuntimeProviderProps) {
  const [newKind, setNewKind] = useState<ConversationKind>("chat");
  const newKindRef = useRef<ConversationKind>("chat");

  const kindValue = useMemo(
    () => ({
      kind: newKind,
      select: (nextKind: ConversationKind) => {
        newKindRef.current = nextKind;
        setNewKind(nextKind);
      },
    }),
    [newKind],
  );

  const listAdapter = useMemo(
    () => createConversationThreadListAdapter(() => newKindRef.current),
    [],
  );

  const listRuntime = useRemoteThreadListRuntime({
    adapter: listAdapter,
    runtimeHook: useConversationRuntime,
  });

  return (
    <NewConversationKindContext.Provider value={kindValue}>
      <AssistantRuntimeProvider runtime={listRuntime}>
        {children}
      </AssistantRuntimeProvider>
    </NewConversationKindContext.Provider>
  );
}

function useConversationRuntime() {
  const assistant = useAui();
  const [threadId] = useState(() => {
    const thread = assistant.threadListItem.getState();

    return thread.status === "new" ? undefined : thread.remoteId;
  });

  const [isLoading, setIsLoading] = useState(!!threadId);
  const [runId, setRunId] = useState<string | null>(null);
  const fileTransport = useMemo(createFileAttachmentTransport, []);

  const savedStatePromiseRef = useRef<Promise<AgentState> | null>(null);
  const connectedThreadIdRef = useRef<string | null>(null);

  const runtime = useAssistantTransportRuntime<AgentState>({
    protocol: "assistant-transport",
    initialState: { messages: [], researchMessages: [] },

    api: "/api/agent/runs",
    resumeStateApi: "/api/agent/runs/resume-state",
    resumeApi: "/api/agent/runs/resume",

    adapters: { attachments: fileTransport.attachmentAdapter },

    converter: (state, connection) => ({
      messages: toThreadMessages(
        state,
        connection,
        fileTransport.getPendingMessageFiles(),
      ),
      state: {
        ...toApplicationState(state),
        isLoading,
        runId,
      } as ReadonlyJSONObject,
      isRunning: connection.isSending,
    }),

    headers: async (): Promise<Record<string, string>> => {
      const token = getAccessToken();
      return token ? { Authorization: `Bearer ${token}` } : {};
    },

    prepareSendCommandsRequest: async (body) => {
      const savedStatePromise = savedStatePromiseRef.current;

      let savedState = savedStatePromise ? await savedStatePromise : undefined;

      const { remoteId: remoteThreadId } =
        await assistant.threadListItem.initialize();

      if (!savedState && !connectedThreadIdRef.current) {
        savedState = await readConversationState(remoteThreadId);
        runtime.thread.importExternalState(savedState);
      }

      connectedThreadIdRef.current = remoteThreadId;

      if (savedStatePromiseRef.current === savedStatePromise) {
        savedStatePromiseRef.current = null;
      }

      const stateToSend = savedState ?? (body.state as AgentState | undefined);
      const modelConfig = body.config as LanguageModelConfig | undefined;
      const commandsToSend = fileTransport.prepareCommands(body.commands);

      return {
        commands: commandsToSend,
        state: stateToSend,
        threadId: remoteThreadId,
        model: modelConfig?.modelName,
        thinkingEnabled: modelConfig?.reasoningEffort === "enabled",
      };
    },

    onResponse: (response) => {
      if (handleUnauthorizedResponse(response)) return;

      setRunId(response.headers.get(RESUMABLE_STREAM_ID_HEADER));
    },

    onFinish: () => {
      setRunId(null);

      fileTransport.complete();
    },

    onError: (error, { updateState }) => {
      fileTransport.discard();

      updateState((state) =>
        state.kind === "research"
          ? {
              ...state,
              runStatus: "failed",
              runError: error.message,
            }
          : state,
      );
    },

    onCancel: ({ updateState, error }) => {
      if (error) return;

      fileTransport.discard();
      updateState((state) =>
        state.kind === "research" &&
        state.runStatus !== "completed" &&
        state.runStatus !== "failed"
          ? { ...state, runStatus: "cancelled", runError: "" }
          : state,
      );
    },
  });

  useEffect(() => {
    setIsLoading(!!threadId);

    if (!threadId) {
      savedStatePromiseRef.current = null;

      return;
    }

    let ignoreResult = false;

    const savedStatePromise = readConversationState(threadId);

    savedStatePromiseRef.current = savedStatePromise;

    void savedStatePromise
      .then((savedState) => {
        if (ignoreResult) return;

        runtime.thread.importExternalState(savedState);

        if (connectedThreadIdRef.current === threadId) return;

        connectedThreadIdRef.current = threadId;

        runtime.thread.resumeRun({ parentId: null });
      })
      .catch((error: unknown) => {
        if (ignoreResult) return;

        toast.error(getApiErrorMessage(error, "会话加载失败，请稍后再试"), {
          id: `conversation-load-${threadId}`,
        });

        savedStatePromiseRef.current = null;
      })
      .finally(() => {
        if (!ignoreResult) setIsLoading(false);
      });

    return () => {
      ignoreResult = true;
    };
  }, [threadId, runtime]);

  return runtime;
}

const messageConverter = createMessageConverter(convertLangChainMessages);

function toThreadMessages(
  state: AgentState,
  connection: AssistantTransportConnectionMetadata,
  pendingFiles: readonly FileMessagePart[],
) {
  const pendingCommand = connection.pendingCommands.find(
    (command) => command.type === "add-message",
  );

  const pendingMessage: LangChainMessage | undefined = pendingCommand
    ? {
        type: "human",
        content: [
          ...pendingCommand.message.parts.map((part) =>
            part.type === "text"
              ? { type: "text" as const, text: part.text }
              : {
                  type: "image_url" as const,
                  image_url: { url: part.image },
                },
          ),
          ...pendingFiles.map((part) => ({
            type: "file" as const,
            url: part.data,
            mime_type: part.mimeType,
            source_type: "url" as const,
            metadata: { filename: part.filename },
          })),
        ],
      }
    : undefined;

  const messages = pendingMessage
    ? [...state.messages, pendingMessage]
    : state.messages;

  return messageConverter
    .toThreadMessages(messages, connection.isSending)
    .map(moveFilesToAttachments);
}

function moveFilesToAttachments(message: ThreadMessage) {
  if (message.role !== "user") return message;

  const attachmentParts = message.content.filter(
    (
      part,
    ): part is Extract<ThreadUserMessagePart, { type: "file" | "image" }> =>
      part.type === "file" || part.type === "image",
  );

  if (attachmentParts.length === 0) return message;

  const attachments: CompleteAttachment[] = attachmentParts.map((part) => {
    if (part.type === "image") {
      return {
        id: part.image,
        type: "image",
        name: part.filename ?? "图片",
        status: { type: "complete" },
        content: [part],
      };
    }

    return {
      id: part.data,
      type: "document",
      name: part.filename ?? "文件",
      contentType: part.mimeType,
      status: { type: "complete" },
      content: [part],
    };
  });

  return {
    ...message,
    content: message.content.filter(
      (part) => part.type !== "file" && part.type !== "image",
    ),
    attachments: [...message.attachments, ...attachments],
  };
}

function toApplicationState(state: AgentState): ApplicationState {
  const baseState = {
    todos: state.todos ?? [],
    artifacts: state.artifacts ?? [],
  };

  if (state.kind !== "research") return baseState;

  return {
    ...baseState,
    runStatus: state.runStatus ?? undefined,
    runStartedAt: state.runStartedAt ?? undefined,
    runFinishedAt: state.runFinishedAt ?? undefined,
    runError: state.runError ?? undefined,
    stage: state.stage ?? undefined,
    plan: state.plan ?? undefined,
    researchMessages: state.researchMessages ?? [],
    outline: state.outline ?? undefined,
    draft: state.draft ?? undefined,
    report: state.report ?? undefined,
  };
}
