"use client";

import {
  type RemoteThreadListAdapter,
  type ThreadMessage,
} from "@assistant-ui/react";
import type { LangChainMessage } from "@assistant-ui/react-langgraph";
import { createAssistantStream } from "assistant-stream";
import {
  agentArchiveConversation,
  agentCreateConversation,
  agentDeleteConversation,
  agentGenerateConversationTitle,
  agentReadConversation,
  agentReadConversations,
  agentRenameConversation,
  agentUnarchiveConversation,
  type ConversationKind,
  type ConversationPublic,
} from "@/lib/client";

const PAGE_SIZE = 100;

function getFirstUserText(messages: readonly ThreadMessage[]): string {
  for (const message of messages) {
    if (message.role !== "user") continue;

    const text = message.content
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n");

    if (text) return text;
  }

  return "";
}

export function createConversationThreadListAdapter(
  getNewConversationKind: () => ConversationKind,
): RemoteThreadListAdapter {
  return {
    async list() {
      const { data } = await agentReadConversations({
        query: { limit: PAGE_SIZE },
        throwOnError: true,
      });

      return {
        threads: data.data.map((conversation) => ({
          remoteId: conversation.id,
          status: conversation.archived ? "archived" : "regular",
          title: conversation.title,
          lastMessageAt: new Date(conversation.updatedAt),
          custom: { persisted: true, kind: conversation.kind },
        })),
      };
    },

    async initialize() {
      const { data } = await agentCreateConversation({
        body: { kind: getNewConversationKind() },
        throwOnError: true,
      });

      return { remoteId: data.id };
    },

    async fetch(remoteId) {
      const { data } = await agentReadConversation({
        path: { conversation_id: remoteId },
        throwOnError: true,
      });

      return {
        remoteId: data.id,
        status: data.archived ? "archived" : "regular",
        title: data.title,
        lastMessageAt: new Date(data.updatedAt),
        custom: { persisted: true, kind: data.kind },
      };
    },

    async generateTitle(remoteId, messages) {
      const text = getFirstUserText(messages);
      if (!text) return createAssistantStream(() => {});

      const { data } = await agentGenerateConversationTitle({
        body: { role: "user", parts: [{ type: "text", text }] },
        path: { conversation_id: remoteId },
        throwOnError: true,
      });

      return createAssistantStream((controller) => {
        controller.appendText(data.title);
      });
    },

    async rename(remoteId, newTitle) {
      await agentRenameConversation({
        body: { title: newTitle },
        path: { conversation_id: remoteId },
        throwOnError: true,
      });
    },

    async archive(remoteId) {
      await agentArchiveConversation({
        path: { conversation_id: remoteId },
        throwOnError: true,
      });
    },

    async unarchive(remoteId) {
      await agentUnarchiveConversation({
        path: { conversation_id: remoteId },
        throwOnError: true,
      });
    },

    async delete(remoteId) {
      await agentDeleteConversation({
        path: { conversation_id: remoteId },
        throwOnError: true,
      });
    },
  };
}

export async function readConversationState(remoteId: string) {
  const { data } = await agentReadConversation({
    path: { conversation_id: remoteId },
    throwOnError: true,
  });

  const { researchMessages = [], ...state } = data.state;

  return {
    ...state,
    research_messages: researchMessages as LangChainMessage[],
  };
}

export async function searchConversations(
  search: string | undefined,
  archived: boolean,
  signal: AbortSignal,
): Promise<ConversationPublic[]> {
  const { data } = await agentReadConversations({
    query: { search, archived, limit: PAGE_SIZE },
    signal,
    throwOnError: true,
  });

  return data.data;
}
