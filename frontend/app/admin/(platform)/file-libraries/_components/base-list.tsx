"use client";

import { usePaginationScrollReset } from "@/hooks/use-pagination-scroll-reset";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { FolderOpenIcon, PencilIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import {
  CARD_PAGE_SIZE,
  CardGrid,
} from "@/components/common/collection-content";
import {
  ResourceCard,
  ResourceCardsSkeleton,
} from "@/components/common/resource-card";
import { AppHeader } from "@/components/layout/app-header";
import { LibraryDialog } from "./library-dialog";
import { getQueryViewState } from "@/lib/query-view-state";
import { LoadError } from "@/components/common/load-error";
import { PageOutOfRange } from "@/components/common/page-out-of-range";
import { useActionFocus } from "@/hooks/use-action-focus";
import { useListParams } from "@/hooks/use-list-params";
import { SearchToolbar } from "@/components/common/search-toolbar";
import { PagePagination } from "@/components/common/page-pagination";
import { DeleteDialog } from "@/components/common/delete-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

import { getApiErrorMessage } from "@/lib/api-error";
import {
  type FileLibraryPublic,
  fileLibrariesDeleteFileLibrary,
  fileLibrariesReadFileLibraries,
} from "@/lib/client";
import { getPaginationHref, parsePage } from "@/lib/pagination";
import { toast } from "sonner";

const FILE_LIBRARIES_QUERY_KEY = ["admin-file-libraries"] as const;
const EMPTY_FILE_LIBRARIES: FileLibraryPublic[] = [];

export function FileLibraryManager() {
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const { rememberActionTrigger, restoreActionFocus } =
    useActionFocus(createButtonRef);

  const router = useRouter();
  const { params: searchParams, update } = useListParams();
  const queryClient = useQueryClient();

  const currentPage = parsePage(searchParams.get("page"));
  const scrollRef = usePaginationScrollReset<HTMLDivElement>(currentPage);
  const pageIndex = currentPage - 1;
  const search = searchParams.get("search")?.trim() ?? "";

  const fileLibrariesQuery = useQuery({
    meta: { handlesInitialError: true },
    queryKey: [...FILE_LIBRARIES_QUERY_KEY, pageIndex, search],
    queryFn: async ({ signal }) => {
      const { data } = await fileLibrariesReadFileLibraries({
        query: {
          skip: pageIndex * CARD_PAGE_SIZE,
          limit: CARD_PAGE_SIZE,
          search: search || undefined,
        },
        signal,
        throwOnError: true,
      });

      return data;
    },
    placeholderData: keepPreviousData,
  });
  const viewState = getQueryViewState(
    fileLibrariesQuery,
    fileLibrariesQuery.data?.data.length === 0,
  );

  const fileLibraries = fileLibrariesQuery.data?.data ?? EMPTY_FILE_LIBRARIES;

  function invalidateFileLibraries(): void {
    void queryClient.invalidateQueries({
      queryKey: FILE_LIBRARIES_QUERY_KEY,
    });
  }

  const [createOpen, setCreateOpen] = useState(false);

  const [fileLibraryToEdit, setFileLibraryToEdit] =
    useState<FileLibraryPublic>();

  const [fileLibraryToDelete, setFileLibraryToDelete] =
    useState<FileLibraryPublic>();

  const deleteFileLibraryMutation = useMutation({
    mutationFn: async (fileLibraryId: string): Promise<void> => {
      await fileLibrariesDeleteFileLibrary({
        path: { file_library_id: fileLibraryId },
        throwOnError: true,
      });
    },
    onSuccess: () => {
      toast.success("文件库已删除");
      if (fileLibrariesQuery.data?.data.length === 1 && currentPage > 1) {
        router.replace(getFileLibrariesHref(currentPage - 1, search));
      }

      setFileLibraryToDelete(undefined);

      invalidateFileLibraries();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "文件库删除失败，请重试"));
    },
  });

  const pageCount = Math.ceil(
    (fileLibrariesQuery.data?.count ?? 0) / CARD_PAGE_SIZE,
  );
  const pageOutOfRange =
    (fileLibrariesQuery.data?.count ?? 0) > 0 && fileLibraries.length === 0;

  return (
    <>
      <AppHeader
        title="文件库"
        actions={
          <Button
            ref={createButtonRef}
            onPointerDown={rememberActionTrigger}
            onFocus={rememberActionTrigger}
            aria-label="创建文件库"
            onClick={() => setCreateOpen(true)}
          >
            <PlusIcon data-icon="inline-start" aria-hidden="true" />
            <span className="hidden sm:inline">创建文件库</span>
          </Button>
        }
      />

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6"
      >
        <section className="mx-auto flex min-h-full max-w-6xl flex-col gap-6">
          <SearchToolbar
            isPending={fileLibrariesQuery.isFetching}
            label="搜索文件库名称"
            placeholder="搜索文件库名称…"
            onSearch={(value) => {
              if (value === (search ?? "")) void fileLibrariesQuery.refetch();
              else update({ search: value });
            }}
            value={search ?? ""}
          />

          {viewState === "loading" ? (
            <ResourceCardsSkeleton showMetadata />
          ) : viewState === "error" ? (
            <LoadError
              title="文件库加载失败"
              isRetrying={fileLibrariesQuery.isFetching}
              onRetry={() => void fileLibrariesQuery.refetch()}
            />
          ) : fileLibraries.length === 0 ? (
            pageOutOfRange ? (
              <PageOutOfRange href={getFileLibrariesHref(1, search)} />
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <FolderOpenIcon aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyTitle>
                    {search ? "未找到符合条件的文件库" : "暂无文件库"}
                  </EmptyTitle>
                </EmptyHeader>
              </Empty>
            )
          ) : (
            <CardGrid
              inert={
                viewState === "ready" && fileLibrariesQuery.isPlaceholderData
              }
              busy={fileLibrariesQuery.isFetching}
              label="文件库列表"
            >
              {fileLibraries.map((fileLibrary) => (
                <li key={fileLibrary.id} className="min-w-0">
                  <ResourceCard
                    onTriggerInteraction={rememberActionTrigger}
                    name={fileLibrary.name}
                    description={fileLibrary.description}
                    href={`/admin/file-libraries/${fileLibrary.id}`}
                    createdAt={fileLibrary.created_at}
                    icon={FolderOpenIcon}

                    actions={
                      <>
                        <DropdownMenuItem
                          onSelect={() => setFileLibraryToEdit(fileLibrary)}
                        >
                          <PencilIcon aria-hidden="true" />
                          编辑
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => {
                            setFileLibraryToDelete(fileLibrary);
                          }}
                        >
                          <TrashIcon aria-hidden="true" />
                          删除
                        </DropdownMenuItem>
                      </>
                    }
                  />
                </li>
              ))}
            </CardGrid>
          )}

          <PagePagination
            className="mt-auto"
            ariaLabel="文件库分页"
            currentPage={currentPage}
            pageCount={pageCount}
            getPageHref={(page) => getFileLibrariesHref(page, search)}
          />
        </section>
      </div>

      {createOpen && (
        <LibraryDialog
          onCloseAutoFocus={restoreActionFocus}
          onClose={() => setCreateOpen(false)}
          onSaved={invalidateFileLibraries}
        />
      )}

      {fileLibraryToEdit && (
        <LibraryDialog
          onCloseAutoFocus={restoreActionFocus}
          library={fileLibraryToEdit}
          onClose={() => setFileLibraryToEdit(undefined)}
          onSaved={invalidateFileLibraries}
        />
      )}

      <DeleteDialog
        onCloseAutoFocus={restoreActionFocus}
        open={fileLibraryToDelete !== undefined}
        pending={deleteFileLibraryMutation.isPending}
        title="删除文件库"
        onOpenChange={(open) => {
          if (!open) setFileLibraryToDelete(undefined);
        }}
        onConfirm={() => {
          if (fileLibraryToDelete)
            deleteFileLibraryMutation.mutate(fileLibraryToDelete.id);
        }}
      >
        确定删除“{fileLibraryToDelete?.name}
        ”吗？库内全部文件和文件夹也会删除，此操作无法撤销。
      </DeleteDialog>
    </>
  );
}

function getFileLibrariesHref(page: number, search: string): string {
  const parameters = new URLSearchParams();

  if (search) {
    parameters.set("search", search);
  }

  return getPaginationHref("/admin/file-libraries", page, parameters);
}
