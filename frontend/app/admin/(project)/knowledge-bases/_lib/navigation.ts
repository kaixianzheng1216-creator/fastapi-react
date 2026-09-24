import { getPaginationHref } from "@/lib/pagination";
import { projectHref } from "@/lib/project-routes";

export function getKnowledgeDirectoryHref(
  projectId: string,
  knowledgeBaseId: string,
  page = 1,
  folderId?: string,
  status?: "ready" | "processing" | "failed",
): string {
  const parameters = new URLSearchParams();
  if (folderId) parameters.set("folder", folderId);
  if (status) parameters.set("status", status);

  return getPaginationHref(
    `${projectHref(projectId)}/${knowledgeBaseId}`,
    page,
    parameters,
  );
}

export function getKnowledgeDocumentHref(
  projectId: string,
  knowledgeBaseId: string,
  documentId: string,
  page: number,
  folderId?: string,
  status?: "ready" | "processing" | "failed",
): string {
  const parameters = new URLSearchParams();
  if (folderId) parameters.set("folder", folderId);
  if (status) parameters.set("status", status);

  return getPaginationHref(
    `${projectHref(projectId)}/${knowledgeBaseId}/documents/${documentId}`,
    page,
    parameters,
  );
}

export function getKnowledgeSearchHref(
  projectId: string,
  knowledgeBaseId: string,
  query: string,
  currentParameters: URLSearchParams,
): string {
  const parameters = new URLSearchParams(currentParameters);

  parameters.set("view", "search");
  if (query) parameters.set("q", query);
  else parameters.delete("q");

  return `${projectHref(projectId)}/${knowledgeBaseId}?${parameters}`;
}
