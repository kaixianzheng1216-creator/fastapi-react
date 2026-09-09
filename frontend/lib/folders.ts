export type Folder = { id: string; name: string; parent_id: string | null };

export function getFolderAncestors<FolderType extends Folder>(
  folderById: ReadonlyMap<string, FolderType>,
  folderId?: string,
): FolderType[] {
  const ancestors: FolderType[] = [];

  let folder = folderId ? folderById.get(folderId) : undefined;

  while (folder) {
    ancestors.unshift(folder);
    folder = folder.parent_id ? folderById.get(folder.parent_id) : undefined;
  }

  return ancestors;
}
