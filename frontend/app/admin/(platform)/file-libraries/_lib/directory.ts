import type { LibraryDirectoryPublic } from "@/lib/client";

export const LIBRARY_FOLDERS_QUERY_KEY = ["library-folders"] as const;
export const LIBRARY_DIRECTORY_QUERY_KEY = ["library-directory"] as const;

export const LIBRARY_DOCUMENT_UPLOAD_KEY = ["library-document-upload"] as const;

export type DirectoryEntry = LibraryDirectoryPublic["data"][number];

export type DirectoryChange =
  | { type: "documents" }
  | { type: "folders" }
  | { type: "moved"; entry: DirectoryEntry }
  | { type: "deleted"; entries: DirectoryEntry[] };

export function getDirectoryEntryKey(entry: DirectoryEntry): string {
  return `${entry.type}:${entry.id}`;
}
