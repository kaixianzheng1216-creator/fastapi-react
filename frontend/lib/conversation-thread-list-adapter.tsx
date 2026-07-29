"use client";

import {
  type RemoteThreadListAdapter,
  type ThreadMessage,
} from "@assistant-ui/react";
import { createAssistantStream } from "assistant-stream";
import { getAccessToken } from "@/lib/auth";
import {
  agentArchiveConversation,
  agentCreateConversation,
  agentDeleteConversation,
  agentGenerateConversationTitle,
  agentReadConversation,
  agentReadConversations,
  agentRenameConversation,
  agentUnarchiveConversation,
  type ConversationPublic,
} from "@/lib/client";

const PAGE_SIZE = 100;

const threadIdToRemoteId = new Map<string, string>();

function resolveRemoteId(threadId: string): string {
  return threadIdToRemoteId.get(threadId) ?? threadId;
}

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

export const conversationThreadListAdapter: RemoteThreadListAdapter = {
  async list() {
    const { data } = await agentReadConversations({
      auth: getAccessToken() ?? undefined,
      query: { limit: PAGE_SIZE },
      throwOnError: true,
    });

    return {
      threads: data.data.map((conversation) => ({
        remoteId: conversation.id,
        status: conversation.archived ? "archived" : "regular",
        title: conversation.title,
        lastMessageAt: new Date(conversation.updatedAt),
        custom: { persisted: true },
      })),
    };
  },

  async initialize(threadId) {
    const { data } = await agentCreateConversation({
      auth: getAccessToken() ?? undefined,
      throwOnError: true,
    });

    threadIdToRemoteId.set(threadId, data.id);

    return { remoteId: data.id, externalId: undefined };
  },

  async fetch(remoteId) {
    const { data } = await agentReadConversation({
      auth: getAccessToken() ?? undefined,
      path: { conversation_id: remoteId },
      throwOnError: true,
    });

    return {
      remoteId: data.id,
      status: data.archived ? "archived" : "regular",
      title: data.title,
      lastMessageAt: new Date(data.updatedAt),
      custom: { persisted: true },
    };
  },

  async generateTitle(remoteId, messages) {
    const text = getFirstUserText(messages);
    if (!text) return createAssistantStream(() => {});

    const { data } = await agentGenerateConversationTitle({
      auth: getAccessToken() ?? undefined,
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
      auth: getAccessToken() ?? undefined,
      body: { title: newTitle },
      path: { conversation_id: resolveRemoteId(remoteId) },
      throwOnError: true,
    });
  },

  async archive(remoteId) {
    await agentArchiveConversation({
      auth: getAccessToken() ?? undefined,
      path: { conversation_id: resolveRemoteId(remoteId) },
      throwOnError: true,
    });
  },

  async unarchive(remoteId) {
    await agentUnarchiveConversation({
      auth: getAccessToken() ?? undefined,
      path: { conversation_id: resolveRemoteId(remoteId) },
      throwOnError: true,
    });
  },

  async delete(remoteId) {
    const resolvedRemoteId = resolveRemoteId(remoteId);

    await agentDeleteConversation({
      auth: getAccessToken() ?? undefined,
      path: { conversation_id: resolvedRemoteId },
      throwOnError: true,
    });

    threadIdToRemoteId.delete(remoteId);
  },
};

export async function readConversationState(remoteId: string) {
  const { data } = await agentReadConversation({
    auth: getAccessToken() ?? undefined,
    path: { conversation_id: remoteId },
    throwOnError: true,
  });

  return data.state;
}

export async function searchConversations(
  search: string | undefined,
  archived: boolean,
  signal: AbortSignal,
): Promise<ConversationPublic[]> {
  const { data } = await agentReadConversations({
    auth: getAccessToken() ?? undefined,
    query: { search, archived, limit: PAGE_SIZE },
    signal,
    throwOnError: true,
  });

  return data.data;
}
