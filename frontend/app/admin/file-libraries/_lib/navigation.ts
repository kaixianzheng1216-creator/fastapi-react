import { getPaginationHref } from "@/lib/pagination";

export function getLibraryDirectoryHref(
  fileLibraryId: string,
  page = 1,
  folderId?: string,
): string {
  return getPaginationHref(
    `/admin/file-libraries/${fileLibraryId}`,
    page,
    new URLSearchParams(folderId ? { folder: folderId } : undefined),
  );
}
