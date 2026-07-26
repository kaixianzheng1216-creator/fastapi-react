"use client";

import {
  type RemoteThreadListAdapter,
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
} from "@/lib/client";

const PAGE_SIZE = 100;

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

  async initialize() {
    const { data } = await agentCreateConversation({
      auth: getAccessToken() ?? undefined,
      throwOnError: true,
    });

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
    const firstUserMessage = messages.find((message) => message.role === "user")!;
    const text = firstUserMessage.content
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n");
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
      path: { conversation_id: remoteId },
      throwOnError: true,
    });
  },

  async archive(remoteId) {
    await agentArchiveConversation({
      auth: getAccessToken() ?? undefined,
      path: { conversation_id: remoteId },
      throwOnError: true,
    });
  },

  async unarchive(remoteId) {
    await agentUnarchiveConversation({
      auth: getAccessToken() ?? undefined,
      path: { conversation_id: remoteId },
      throwOnError: true,
    });
  },

  async delete(remoteId) {
    await agentDeleteConversation({
      auth: getAccessToken() ?? undefined,
      path: { conversation_id: remoteId },
      throwOnError: true,
    });
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
