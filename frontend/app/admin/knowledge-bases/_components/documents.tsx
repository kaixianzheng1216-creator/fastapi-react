"use client";

import { CollectionContent } from "@/components/common/collection-content";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderOpenIcon } from "lucide-react";
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
import { LoadError } from "@/components/common/load-error";
import { PageOutOfRange } from "@/components/common/page-out-of-range";
import { PagePagination } from "@/components/common/page-pagination";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/common/table-skeleton";
import {
  type KnowledgeFolderPublic,
  knowledgeBasesReadDirectory,
  knowledgeBasesReadFolders,
} from "@/lib/client";
import { getFolderAncestors } from "@/lib/folders";
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
    meta: { handlesInitialError: true },
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
  });

  const folders = foldersQuery.data?.data ?? EMPTY_FOLDERS;
  const folderById = new Map(folders.map((folder) => [folder.id, folder]));
  const currentPath = getFolderAncestors(folderById, currentFolderId);

  const directoryQuery = useQuery({
    meta: { handlesInitialError: true },
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
      if (query.state.status === "error") return false;

      const hasProcessingDocument = query.state.data?.data.some(
        (entry) =>
          entry.type === "document" &&
          (entry.status === "processing" ||
            (entry.status === "pending" && entry.uploaded)),
      );

      return hasProcessingDocument ? DOCUMENT_POLL_INTERVAL_MS : false;
    },
    enabled: activeView === "documents",
    placeholderData: (previousData, previousQuery) => {
      const previousQueryKey = previousQuery?.queryKey;

      return previousQueryKey?.at(-3) === knowledgeBaseId &&
        previousQueryKey.at(-2) === currentFolderId
        ? previousData
        : undefined;
    },
  });

  const directoryEntries = directoryQuery.data?.data ?? EMPTY_DIRECTORY_ENTRIES;
  const totalEntryCount = directoryQuery.data?.count ?? 0;
  const pageCount = Math.ceil(totalEntryCount / PAGE_SIZE);
  const pageOutOfRange = totalEntryCount > 0 && directoryEntries.length === 0;

  const directoryPending = foldersQuery.isPending || directoryQuery.isPending;
  const directoryLoadFailed =
    (foldersQuery.isError && foldersQuery.data === undefined) ||
    (directoryQuery.isError && directoryQuery.data === undefined);

  function invalidateDocuments(): void {
    void queryClient.invalidateQueries({
      queryKey: [...KNOWLEDGE_DIRECTORY_QUERY_KEY, knowledgeBaseId],
    });
    void queryClient.invalidateQueries({
      queryKey: [...KNOWLEDGE_SEARCH_QUERY_KEY, knowledgeBaseId],
    });
  }

  function invalidateFolders(): void {
    void queryClient.invalidateQueries({
      queryKey: [...KNOWLEDGE_FOLDERS_QUERY_KEY, knowledgeBaseId],
    });
    invalidateDocuments();
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

  function handleDirectoryChange(change: DirectoryChange): void {
    switch (change.type) {
      case "documents":
        invalidateDocuments();
        break;

      case "folders":
        invalidateFolders();
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

        if (change.entry.type === "folder") {
          invalidateFolders();
        } else {
          invalidateDocuments();
        }
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

        invalidateFolders();
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
      className="flex flex-1 flex-col gap-6 md:min-h-0"
    >
      <KnowledgeDocumentImport
        knowledgeBaseId={knowledgeBaseId}
        folderId={currentFolderId}
        onDocumentsChanged={invalidateDocuments}
      />

      {directoryPending ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-8 w-28" />
          </div>
          <TableSkeleton columns={6} />
        </div>
      ) : directoryLoadFailed ? (
        <LoadError
          title="文档列表加载失败"
          isRetrying={foldersQuery.isFetching || directoryQuery.isFetching}
          onRetry={() => {
            void foldersQuery.refetch();
            void directoryQuery.refetch();
          }}
        />
      ) : (
        <section className="flex flex-1 flex-col gap-3 md:min-h-0 md:overflow-y-auto">
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
            <CollectionContent
              busy={directoryQuery.isPlaceholderData}
              containerClassName="md:min-h-0 md:flex-1"
              className="md:h-full"
            >
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
            </CollectionContent>
          ) : pageOutOfRange ? (
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
                  <FolderOpenIcon aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>此文件夹为空</EmptyTitle>
                <EmptyDescription>
                  上传文件、添加网页或新建文件夹。
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </section>
      )}
      <PagePagination
        className="shrink-0"
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
