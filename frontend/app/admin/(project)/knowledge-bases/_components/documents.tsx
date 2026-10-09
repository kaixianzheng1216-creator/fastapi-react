"use client";

import { usePaginationScrollReset } from "@/hooks/use-pagination-scroll-reset";

import { CollectionContent } from "@/components/common/collection-content";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, useRef, useState } from "react";

import {
  DirectoryActionDialogs,
  DirectoryBatchActions,
  DirectoryEntryActions,
  useDirectoryActions,
} from "@/app/admin/(project)/knowledge-bases/_components/directory-actions";
import { KnowledgeDirectoryTable } from "@/app/admin/(project)/knowledge-bases/_components/directory-table";
import { KnowledgeDocumentImport } from "@/app/admin/(project)/knowledge-bases/_components/document-import";
import {
  type DirectoryChange,
  type DirectoryEntry,
  KNOWLEDGE_DIRECTORY_QUERY_KEY,
  KNOWLEDGE_FOLDERS_QUERY_KEY,
  KNOWLEDGE_SEARCH_QUERY_KEY,
  documentStatusLabels,
  getDirectoryEntryKey,
} from "@/app/admin/(project)/knowledge-bases/_lib/directory";
import {
  getKnowledgeDirectoryHref,
  getKnowledgeDocumentHref,
} from "@/app/admin/(project)/knowledge-bases/_lib/navigation";
import { FilterGroup } from "@/app/admin/_components/filter-group";
import { LoadError } from "@/components/common/load-error";
import { PagePagination } from "@/components/common/page-pagination";
import { SearchToolbar } from "@/components/common/search-toolbar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { ToggleGroupItem } from "@/components/ui/toggle-group";
import { useListParams } from "@/hooks/use-list-params";
import {
  type KnowledgeFolderPublic,
  knowledgeBasesReadDirectory,
  knowledgeBasesReadFolders,
} from "@/lib/client";
import { getFolderAncestors } from "@/lib/folders";
import { parsePage } from "@/lib/pagination";
import { getQueryViewState } from "@/lib/query-view-state";

const PAGE_SIZE = 20;
const DOCUMENT_POLL_INTERVAL_MS = 3000;

const EMPTY_DIRECTORY_ENTRIES: DirectoryEntry[] = [];
const EMPTY_FOLDERS: KnowledgeFolderPublic[] = [];
const EMPTY_ENTRY_KEYS = new Set<string>();

type DocumentStatus = "ready" | "processing" | "failed";

const statusOptions: DocumentStatus[] = ["ready", "processing", "failed"];

export function KnowledgeDocuments({
  projectId,
  knowledgeBaseId,
}: {
  projectId: string;
  knowledgeBaseId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { update } = useListParams();
  const search = searchParams.get("search")?.trim() ?? "";
  const queryClient = useQueryClient();
  const documentsRef = useRef<HTMLElement>(null);

  const currentPage = parsePage(searchParams.get("page"));
  const scrollRef = usePaginationScrollReset<HTMLElement>(currentPage);
  const statusParameter = searchParams.get("status");
  const currentStatus: DocumentStatus | undefined =
    statusParameter === "ready" ||
    statusParameter === "processing" ||
    statusParameter === "failed"
      ? statusParameter
      : undefined;
  const currentFolderId = search
    ? undefined
    : (searchParams.get("folder") ?? undefined);
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
  const folderPaths = new Map<string, string>();

  if (currentStatus || search) {
    for (const folder of folders) {
      const ancestors = getFolderAncestors(folderById, folder.id);
      folderPaths.set(
        folder.id,
        ancestors.map((item) => item.name).join(" / "),
      );
    }
  }

  const directoryQuery = useQuery({
    meta: { handlesInitialError: true },
    queryKey: [
      ...KNOWLEDGE_DIRECTORY_QUERY_KEY,
      knowledgeBaseId,
      currentFolderId,
      currentStatus,
      search,
      pageIndex,
    ],
    queryFn: async ({ signal }) => {
      const { data } = await knowledgeBasesReadDirectory({
        path: { knowledge_base_id: knowledgeBaseId },
        query: {
          folder_id: currentFolderId,
          document_status: currentStatus,
          search: search || undefined,
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

      return hasProcessingDocument || query.state.data?.status_counts.processing
        ? DOCUMENT_POLL_INTERVAL_MS
        : false;
    },
    enabled: activeView === "documents",
    placeholderData: (previousData, previousQuery) => {
      const previousQueryKey = previousQuery?.queryKey;

      return previousQueryKey?.at(-5) === knowledgeBaseId &&
        previousQueryKey.at(-4) === currentFolderId &&
        previousQueryKey.at(-3) === currentStatus &&
        previousQueryKey.at(-2) === search
        ? previousData
        : undefined;
    },
  });

  const directoryEntries = directoryQuery.data?.data ?? EMPTY_DIRECTORY_ENTRIES;
  const statusCounts = directoryQuery.data?.status_counts;
  const totalEntryCount = directoryQuery.data?.count ?? 0;
  const pageCount = Math.ceil(totalEntryCount / PAGE_SIZE);

  const foldersState = getQueryViewState(foldersQuery);
  const directoryState = getQueryViewState(
    directoryQuery,
    directoryEntries.length === 0,
  );
  const directoryLoadFailed =
    foldersState === "error" || directoryState === "error";
  const directoryPending =
    !directoryLoadFailed &&
    (foldersState === "loading" || directoryState === "loading");
  const actionsDisabled =
    directoryPending ||
    directoryLoadFailed ||
    Boolean(currentFolderId && !folderById.has(currentFolderId));

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
          projectId,
          knowledgeBaseId,
          currentPage - 1,
          currentFolderId,
          currentStatus,
          search,
        ),
      );
    }
  }

  const selectionScope = `${knowledgeBaseId}:${currentFolderId ?? "root"}:${currentStatus ?? "all"}:${search}:${currentPage}`;
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

      case "moved": {
        const movedKeys = new Set(change.entries.map(getDirectoryEntryKey));

        if (
          !currentStatus &&
          !search &&
          change.folderId !== (currentFolderId ?? null)
        ) {
          navigateAfterRemovingEntries(
            directoryEntries.filter((entry) =>
              movedKeys.has(getDirectoryEntryKey(entry)),
            ).length,
          );
        }

        selectEntries(
          new Set([...selectedEntryKeys].filter((key) => !movedKeys.has(key))),
        );

        if (change.entries.some((entry) => entry.type === "folder")) {
          invalidateFolders();
        } else {
          invalidateDocuments();
        }
        break;
      }

      case "deleted": {
        navigateAfterRemovingEntries(change.entries.length);
        selectEntries(new Set());

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
      <section
        ref={scrollRef}
        className="flex flex-1 flex-col gap-3 md:min-h-0 md:overflow-y-auto"
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <KnowledgeDocumentImport
            key={currentFolderId ?? "root"}
            knowledgeBaseId={knowledgeBaseId}
            folderId={currentFolderId}
            onDocumentsChanged={invalidateDocuments}
            disabled={actionsDisabled}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={actionsDisabled}
            onClick={() => actions.editFolder(null)}
            onFocus={actions.rememberActionTrigger}
            onPointerDown={actions.rememberActionTrigger}
          >
            新建文件夹
          </Button>
          <DirectoryBatchActions
            entries={selectedEntries}
            actions={actions}
            disabled={actionsDisabled || directoryQuery.isPlaceholderData}
          />
          {selectedEntries.length > 0 && (
            <>
              <span className="text-sm text-muted-foreground" role="status">
                已选 {selectedEntries.length} 项
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={actions.isActionPending}
                onClick={() => {
                  selectEntries(new Set());
                  documentsRef.current?.focus({ preventScroll: true });
                }}
              >
                取消选择
              </Button>
            </>
          )}
        </div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <SearchToolbar
            label="按文档名称查找"
            placeholder="按文档名称查找…"
            maxLength={100}
            value={search}
            onSearch={(value) => {
              if (value === search) void directoryQuery.refetch();
              else update({ search: value, folder: "" });
            }}
          />

          {!directoryLoadFailed && !directoryPending && statusCounts && (
            <FilterGroup
              label="状态筛选"
              value={currentStatus ?? "all"}
              onValueChange={(value) =>
                update({ status: value === "all" ? "" : value })
              }
            >
              <ToggleGroupItem value="all">全部</ToggleGroupItem>
              {statusOptions.map((status) => (
                <ToggleGroupItem key={status} value={status}>
                  {documentStatusLabels[status]} {statusCounts[status]}
                </ToggleGroupItem>
              ))}
            </FilterGroup>
          )}
        </div>

        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              {currentFolderId || currentStatus ? (
                <BreadcrumbLink asChild>
                  <Link
                    href={getKnowledgeDirectoryHref(
                      projectId,
                      knowledgeBaseId,
                    )}
                  >
                    根目录
                  </Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>根目录</BreadcrumbPage>
              )}
            </BreadcrumbItem>
            {currentFolderId && !folderById.has(currentFolderId) && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>
                    {foldersQuery.isPending ? "加载目录中…" : "目录不可用"}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
            {currentPath.map((folder, index) => (
              <Fragment key={folder.id}>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  {index === currentPath.length - 1 && !currentStatus ? (
                    <BreadcrumbPage>{folder.name}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link
                        href={getKnowledgeDirectoryHref(
                          projectId,
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
            {currentStatus && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>
                    {documentStatusLabels[currentStatus]}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>

        {directoryLoadFailed ? (
          <LoadError
            title="文档列表加载失败"
            isRetrying={foldersQuery.isFetching || directoryQuery.isFetching}
            onRetry={() => {
              void foldersQuery.refetch();
              void directoryQuery.refetch();
            }}
          />
        ) : (
          <CollectionContent
            busy={directoryState !== "loading" && directoryQuery.isFetching}
            inert={
              directoryState === "ready" && directoryQuery.isPlaceholderData
            }
            className="md:min-h-0 md:h-full md:flex-1"
          >
            <KnowledgeDirectoryTable
              emptyMessage={
                search
                  ? "未找到匹配的文档"
                  : currentStatus
                    ? "暂无此状态文档"
                    : "此文件夹为空"
              }
              loading={directoryPending}
              currentPage={currentPage}
              projectId={projectId}
              knowledgeBaseId={knowledgeBaseId}
              entries={directoryEntries}
              folderPaths={currentStatus || search ? folderPaths : undefined}
              selectedEntryKeys={selectedEntryKeys}
              onSelectionChange={selectEntries}
              getDocumentHref={(documentId) =>
                getKnowledgeDocumentHref(
                  projectId,
                  knowledgeBaseId,
                  documentId,
                  currentPage,
                  currentFolderId,
                  currentStatus,
                  search,
                )
              }
              renderActions={(entry) => (
                <DirectoryEntryActions entry={entry} actions={actions} />
              )}
            />
          </CollectionContent>
        )}
      </section>
      <PagePagination
        className="shrink-0"
        ariaLabel="知识库目录分页"
        currentPage={currentPage}
        pageCount={pageCount}
        pending={
          activeView !== "documents" ||
          directoryQuery.data === undefined ||
          directoryQuery.isPlaceholderData
        }
        getPageHref={(page) =>
          getKnowledgeDirectoryHref(
            projectId,
            knowledgeBaseId,
            page,
            currentFolderId,
            currentStatus,
            search,
          )
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
