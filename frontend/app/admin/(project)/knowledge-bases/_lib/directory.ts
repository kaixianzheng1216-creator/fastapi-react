import type {
  KnowledgeDirectoryPublic,
  KnowledgeDocumentPublic,
} from "@/lib/client";

export const documentStatusLabels: Record<
  KnowledgeDocumentPublic["status"],
  string
> = {
  pending: "等待处理",
  processing: "处理中",
  ready: "已完成",
  failed: "失败",
  timed_out: "已超时",
};

export const KNOWLEDGE_FOLDERS_QUERY_KEY = ["knowledge-folders"] as const;

export const KNOWLEDGE_DIRECTORY_QUERY_KEY = ["knowledge-directory"] as const;

export const KNOWLEDGE_SEARCH_QUERY_KEY = ["knowledge-search"] as const;

export const KNOWLEDGE_DOCUMENT_UPLOAD_KEY = [
  "knowledge-document-upload",
] as const;

export type DirectoryEntry = KnowledgeDirectoryPublic["data"][number];

export type DirectoryChange =
  | { type: "documents" }
  | { type: "folders" }
  | { type: "moved"; entries: DirectoryEntry[]; folderId: string | null }
  | { type: "deleted"; entries: DirectoryEntry[] };

export function getDirectoryEntryKey(entry: DirectoryEntry): string {
  return `${entry.type}:${entry.id}`;
}
