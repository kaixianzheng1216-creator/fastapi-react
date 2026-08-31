import type { KnowledgeDirectoryPublic } from "@/lib/client";

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
  | { type: "moved"; entry: DirectoryEntry }
  | { type: "deleted"; entries: DirectoryEntry[] };

export function getDirectoryEntryKey(entry: DirectoryEntry): string {
  return `${entry.type}:${entry.id}`;
}
