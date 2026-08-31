"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircleIcon, FileTextIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, useRef, useState } from "react";

import {
  DirectoryActionDialogs,
  DirectoryEntryActions,
  DirectoryToolbar,
  useDirectoryActions,
} from "@/app/admin/knowledge-bases/_components/directory-actions";
import { KnowledgeDirectoryTable } from "@/app/admin/knowledge-bases/_components/directory-table";
import {
  getDirectoryEntryKey,
  type DirectoryEntry,
  type DirectoryChange,
  KNOWLEDGE_FOLDERS_QUERY_KEY,
  KNOWLEDGE_DIRECTORY_QUERY_KEY,
  KNOWLEDGE_SEARCH_QUERY_KEY,
} from "@/app/admin/knowledge-bases/_lib/directory";
import {
  getKnowledgeDirectoryHref,
  getKnowledgeDocumentHref,
} from "@/app/admin/knowledge-bases/_lib/navigation";
import { KnowledgeDocumentImport } from "@/app/admin/knowledge-bases/_components/document-import";
import { PageOutOfRange } from "@/components/shared/page-out-of-range";
import { PagePagination } from "@/components/shared/page-pagination";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  type KnowledgeFolderPublic,
  knowledgeBasesReadDirectory,
  knowledgeBasesReadFolders,
} from "@/lib/client";
import { getFolderAncestors } from "@/lib/knowledge-folders";
import { parsePage } from "@/lib/pagination";

const PAGE_SIZE = 20;
const DOCUMENT_POLL_INTERVAL_MS = 3000;

const EMPTY_DIRECTORY_ENTRIES: DirectoryEntry[] = [];
const EMPTY_FOLDERS: KnowledgeFolderPublic[] = [];
const EMPTY_ENTRY_KEYS = new Set<string>();

export function KnowledgeDocuments({
  knowledgeBaseId,
}: {
  knowledgeBaseId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const documentsRef = useRef<HTMLElement>(null);

  const currentPage = parsePage(searchParams.get("page"));
  const currentFolderId = searchParams.get("folder") ?? undefined;
  const pageIndex = currentPage - 1;
  const activeView =
    searchParams.get("view") === "search" ? "search" : "documents";

  const foldersQuery = useQuery({
    queryKey: [...KNOWLEDGE_FOLDERS_QUERY_KEY, knowledgeBaseId],
    queryFn: async ({ signal }) => {
      const { data } = await knowledgeBasesReadFolders({
        path: { knowledge_base_id: knowledgeBaseId },
        signal,
        throwOnError: true,
      });

      return data;
    },
    enabled: activeView === "documents",
    retry: false,
  });

  const folders = foldersQuery.data?.data ?? EMPTY_FOLDERS;
  const folderById = new Map(folders.map((folder) => [folder.id, folder]));
  const currentPath = getFolderAncestors(folderById, currentFolderId);

  const directoryQuery = useQuery({
    queryKey: [
      ...KNOWLEDGE_DIRECTORY_QUERY_KEY,
      knowledgeBaseId,
      currentFolderId,
      pageIndex,
    ],
    queryFn: async ({ signal }) => {
      const { data } = await knowledgeBasesReadDirectory({
        path: { knowledge_base_id: knowledgeBaseId },
        query: {
          folder_id: currentFolderId,
          skip: pageIndex * PAGE_SIZE,
          limit: PAGE_SIZE,
        },
        signal,
        throwOnError: true,
      });

      return data;
    },
    refetchInterval: (query) => {
      const hasProcessingDocument = query.state.data?.data.some(
        (entry) =>
          entry.type === "document" &&
          (entry.status === "processing" ||
            (entry.status === "pending" && entry.uploaded)),
      );

      return hasProcessingDocument ? DOCUMENT_POLL_INTERVAL_MS : false;
    },
    enabled: activeView === "documents",
    retry: false,
  });

  const directoryEntries = directoryQuery.data?.data ?? EMPTY_DIRECTORY_ENTRIES;
  const totalEntryCount = directoryQuery.data?.count ?? 0;
  const pageCount = Math.ceil(totalEntryCount / PAGE_SIZE);
  const pageOutOfRange = totalEntryCount > 0 && directoryEntries.length === 0;

  const directoryPending = foldersQuery.isPending || directoryQuery.isPending;
  const directoryError = foldersQuery.error ?? directoryQuery.error;
  const hasDirectoryEntries = directoryEntries.length > 0;

  async function refreshDocuments(): Promise<void> {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: [...KNOWLEDGE_DIRECTORY_QUERY_KEY, knowledgeBaseId],
      }),
      queryClient.invalidateQueries({
        queryKey: [...KNOWLEDGE_SEARCH_QUERY_KEY, knowledgeBaseId],
      }),
    ]);
  }

  async function refreshFolders(): Promise<void> {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: [...KNOWLEDGE_FOLDERS_QUERY_KEY, knowledgeBaseId],
      }),
      refreshDocuments(),
    ]);
  }

  function navigateAfterRemovingEntries(removedCount: number): void {
    if (directoryEntries.length <= removedCount && currentPage > 1) {
      router.replace(
        getKnowledgeDirectoryHref(
          knowledgeBaseId,
          currentPage - 1,
          currentFolderId,
        ),
      );
    }
  }

  const selectionScope = `${knowledgeBaseId}:${currentFolderId ?? "root"}:${currentPage}`;
  const [directorySelection, setDirectorySelection] = useState<{
    scope: string;
    keys: Set<string>;
  }>({ scope: "", keys: new Set() });

  const selectedEntryKeys =
    directorySelection.scope === selectionScope
      ? directorySelection.keys
      : EMPTY_ENTRY_KEYS;

  const selectedEntries = directoryEntries.filter((entry) =>
    selectedEntryKeys.has(getDirectoryEntryKey(entry)),
  );

  function selectEntries(keys: Set<string>): void {
    setDirectorySelection({ scope: selectionScope, keys });
  }

  async function handleDirectoryChange(change: DirectoryChange): Promise<void> {
    switch (change.type) {
      case "documents":
        await refreshDocuments();
        break;

      case "folders":
        await refreshFolders();
        break;

      case "moved":
        if (
          directoryEntries.some(
            (entry) =>
              getDirectoryEntryKey(entry) ===
              getDirectoryEntryKey(change.entry),
          )
        ) {
          navigateAfterRemovingEntries(1);
        }

        await (change.entry.type === "folder"
          ? refreshFolders()
          : refreshDocuments());
        break;

      case "deleted": {
        const deletedCurrentFolder = change.entries.find(
          (entry) => entry.type === "folder" && entry.id === currentFolderId,
        );

        if (deletedCurrentFolder?.type === "folder") {
          router.replace(
            getKnowledgeDirectoryHref(
              knowledgeBaseId,
              1,
              deletedCurrentFolder.parent_id ?? undefined,
            ),
          );
        } else {
          navigateAfterRemovingEntries(change.entries.length);
        }

        setDirectorySelection({ scope: selectionScope, keys: new Set() });

        await refreshFolders();
        break;
      }
    }
  }

  const actions = useDirectoryActions({
    knowledgeBaseId,
    focusFallbackRef: documentsRef,
    onChanged: handleDirectoryChange,
  });

  return (
    <section
      ref={documentsRef}
      tabIndex={-1}
      aria-label="知识库文档"
      className="flex min-h-full flex-col gap-6"
    >
      <KnowledgeDocumentImport
        knowledgeBaseId={knowledgeBaseId}
        folderId={currentFolderId}
        onDocumentsChanged={refreshDocuments}
      />

      {actions.actionError ? (
        <Alert variant="destructive">
          <AlertCircleIcon aria-hidden="true" />
          <AlertTitle>
            {getApiErrorMessage(actions.actionError, "文档操作失败")}
          </AlertTitle>
        </Alert>
      ) : null}

      {directoryPending ? (
        <Skeleton className="h-20" role="status" aria-label="正在加载目录" />
      ) : directoryError ? (
        <Alert variant="destructive">
          <AlertCircleIcon aria-hidden="true" />
          <AlertTitle>
            {getApiErrorMessage(directoryError, "读取目录失败")}
          </AlertTitle>
          <AlertDescription>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void Promise.all([
                  foldersQuery.refetch(),
                  directoryQuery.refetch(),
                ]);
              }}
            >
              重试
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  {currentPath.length > 0 ? (
                    <BreadcrumbLink asChild>
                      <Link href={getKnowledgeDirectoryHref(knowledgeBaseId)}>
                        全部文档
                      </Link>
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage>全部文档</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
                {currentPath.map((folder, index) => (
                  <Fragment key={folder.id}>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      {index === currentPath.length - 1 ? (
                        <BreadcrumbPage>{folder.name}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild>
                          <Link
                            href={getKnowledgeDirectoryHref(
                              knowledgeBaseId,
                              1,
                              folder.id,
                            )}
                          >
                            {folder.name}
                          </Link>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>

            <DirectoryToolbar
              actions={actions}
              currentFolder={folderById.get(currentFolderId ?? "")}
              selectedEntries={selectedEntries}
            />
          </div>

          {directoryEntries.length > 0 ? (
            <KnowledgeDirectoryTable
              knowledgeBaseId={knowledgeBaseId}
              entries={directoryEntries}
              selectedEntryKeys={selectedEntryKeys}
              onSelectionChange={selectEntries}
              getDocumentHref={(documentId) =>
                getKnowledgeDocumentHref(
                  knowledgeBaseId,
                  documentId,
                  currentPage,
                  currentFolderId,
                )
              }
              renderActions={(entry) => (
                <DirectoryEntryActions entry={entry} actions={actions} />
              )}
            />
          ) : null}
        </section>
      )}

      {!directoryPending && !directoryError && !hasDirectoryEntries ? (
        pageOutOfRange ? (
          <PageOutOfRange
            href={getKnowledgeDirectoryHref(
              knowledgeBaseId,
              1,
              currentFolderId,
            )}
          />
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileTextIcon aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>暂无文档</EmptyTitle>
              <EmptyDescription>
                添加文件或网页后，会在这里显示处理状态。
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )
      ) : null}

      <PagePagination
        className="mt-auto"
        ariaLabel="知识库目录分页"
        currentPage={currentPage}
        pageCount={pageCount}
        getPageHref={(page) =>
          getKnowledgeDirectoryHref(knowledgeBaseId, page, currentFolderId)
        }
      />

      <DirectoryActionDialogs
        actions={actions}
        knowledgeBaseId={knowledgeBaseId}
        currentFolderId={currentFolderId}
        folders={folders}
      />
    </section>
  );
}
