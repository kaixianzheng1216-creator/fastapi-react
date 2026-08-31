import type { KnowledgeFolderPublic } from "@/lib/client";

export function getFolderAncestors(
  folderById: ReadonlyMap<string, KnowledgeFolderPublic>,
  folderId?: string,
): KnowledgeFolderPublic[] {
  const ancestors: KnowledgeFolderPublic[] = [];

  let folder = folderId ? folderById.get(folderId) : undefined;

  while (folder) {
    ancestors.unshift(folder);
    folder = folder.parent_id ? folderById.get(folder.parent_id) : undefined;
  }

  return ancestors;
}
