import { getPaginationHref } from "@/lib/pagination";

export function getKnowledgeDirectoryHref(
  knowledgeBaseId: string,
  page = 1,
  folderId?: string,
): string {
  return getPaginationHref(
    `/admin/knowledge-bases/${knowledgeBaseId}`,
    page,
    new URLSearchParams(folderId ? { folder: folderId } : undefined),
  );
}

export function getKnowledgeDocumentHref(
  knowledgeBaseId: string,
  documentId: string,
  page: number,
  folderId?: string,
): string {
  return getPaginationHref(
    `/admin/knowledge-bases/${knowledgeBaseId}/documents/${documentId}`,
    page,
    new URLSearchParams(folderId ? { folder: folderId } : undefined),
  );
}

export function getKnowledgeSearchHref(
  knowledgeBaseId: string,
  query: string,
  currentParameters: URLSearchParams,
): string {
  const parameters = new URLSearchParams(currentParameters);

  parameters.set("view", "search");
  parameters.set("q", query);

  return `/admin/knowledge-bases/${knowledgeBaseId}?${parameters}`;
}
