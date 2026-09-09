"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  BookOpenIcon,
  PencilIcon,
  PlusIcon,
  PowerIcon,
  PowerOffIcon,
  TrashIcon,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";

import {
  CARD_PAGE_SIZE,
  CardGrid,
} from "@/components/common/collection-content";
import {
  ResourceCard,
  ResourceCardsSkeleton,
} from "@/components/common/resource-card";
import { AppHeader } from "@/components/layout/app-header";
import { LibraryDialog } from "@/components/common/library-dialog";
import { LoadError } from "@/components/common/load-error";
import { PageOutOfRange } from "@/components/common/page-out-of-range";
import { SearchToolbar } from "@/components/common/search-toolbar";
import { PagePagination } from "@/components/common/page-pagination";
import { DeleteDialog } from "@/components/common/delete-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldTitle } from "@/components/ui/field";
import { SidebarTrigger } from "@/components/ui/sidebar";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  type KnowledgeBasePublic,
  knowledgeBasesDeleteKnowledgeBase,
  knowledgeBasesReadKnowledgeBases,
  knowledgeBasesUpdateKnowledgeBase,
} from "@/lib/client";
import { getPaginationHref, parsePage } from "@/lib/pagination";
import { toast } from "sonner";

const KNOWLEDGE_BASES_QUERY_KEY = ["admin-knowledge-bases"] as const;
const EMPTY_KNOWLEDGE_BASES: KnowledgeBasePublic[] = [];

type StatusFilter = "all" | "enabled" | "disabled";

export function KnowledgeBaseManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const currentPage = parsePage(searchParams.get("page"));
  const pageIndex = currentPage - 1;
  const search = searchParams.get("search")?.trim() ?? "";
  const status = getStatusFilter(searchParams.get("status"));

  const knowledgeBasesQuery = useQuery({
    meta: { handlesInitialError: true },
    queryKey: [...KNOWLEDGE_BASES_QUERY_KEY, pageIndex, search, status],
    queryFn: async ({ signal }) => {
      const { data } = await knowledgeBasesReadKnowledgeBases({
        query: {
          skip: pageIndex * CARD_PAGE_SIZE,
          limit: CARD_PAGE_SIZE,
          search: search || undefined,
          is_enabled: status === "all" ? undefined : status === "enabled",
        },
        signal,
        throwOnError: true,
      });

      return data;
    },
    placeholderData: keepPreviousData,
  });

  const knowledgeBases =
    knowledgeBasesQuery.data?.data ?? EMPTY_KNOWLEDGE_BASES;

  function submitSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    const nextSearch = String(formData.get("search") ?? "").trim();

    router.push(getKnowledgeBasesHref(1, nextSearch, status));
  }

  function changeStatus(nextStatus: string): void {
    if (nextStatus) {
      router.push(getKnowledgeBasesHref(1, search, nextStatus as StatusFilter));
    }
  }

  function invalidateKnowledgeBases(): void {
    void queryClient.invalidateQueries({
      queryKey: KNOWLEDGE_BASES_QUERY_KEY,
    });
  }

  const [createOpen, setCreateOpen] = useState(false);

  const [knowledgeBaseToEdit, setKnowledgeBaseToEdit] =
    useState<KnowledgeBasePublic>();

  const updateStatusMutation = useMutation({
    mutationFn: async (knowledgeBase: KnowledgeBasePublic): Promise<void> => {
      await knowledgeBasesUpdateKnowledgeBase({
        path: { knowledge_base_id: knowledgeBase.id },
        body: { is_enabled: !knowledgeBase.is_enabled },
        throwOnError: true,
      });
    },
    onSuccess: () => {
      toast.success("知识库状态已更新");
      invalidateKnowledgeBases();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "知识库状态更新失败，请重试"));
    },
  });

  const changeKnowledgeBaseStatus = updateStatusMutation.mutate;

  const [knowledgeBaseToDelete, setKnowledgeBaseToDelete] =
    useState<KnowledgeBasePublic>();

  const deleteKnowledgeBaseMutation = useMutation({
    mutationFn: async (knowledgeBaseId: string): Promise<void> => {
      await knowledgeBasesDeleteKnowledgeBase({
        path: { knowledge_base_id: knowledgeBaseId },
        throwOnError: true,
      });
    },
    onSuccess: () => {
      toast.success("知识库已删除");
      if (knowledgeBasesQuery.data?.data.length === 1 && currentPage > 1) {
        router.replace(getKnowledgeBasesHref(currentPage - 1, search, status));
      }

      setKnowledgeBaseToDelete(undefined);

      invalidateKnowledgeBases();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "知识库删除失败，请重试"));
    },
  });

  const pageCount = Math.ceil(
    (knowledgeBasesQuery.data?.count ?? 0) / CARD_PAGE_SIZE,
  );
  const pageOutOfRange =
    (knowledgeBasesQuery.data?.count ?? 0) > 0 && knowledgeBases.length === 0;

  return (
    <>
      <AppHeader
        title="知识库"
        left={<SidebarTrigger className="size-9" aria-label="切换管理菜单" />}
        actions={
          <Button aria-label="创建知识库" onClick={() => setCreateOpen(true)}>
            <PlusIcon data-icon="inline-start" aria-hidden="true" />
            <span className="hidden sm:inline">创建知识库</span>
          </Button>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
        <section className="mx-auto flex min-h-full max-w-6xl flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SearchToolbar
              id="knowledge-base-search"
              label="搜索知识库名称"
              placeholder="搜索知识库名称…"
              onSubmit={submitSearch}
              key={search}
              defaultValue={search}
            />

            <Field orientation="horizontal" className="w-auto">
              <FieldTitle id="knowledge-base-status">状态</FieldTitle>
              <ToggleGroup
                type="single"
                variant="outline"
                value={status}
                onValueChange={changeStatus}
                aria-labelledby="knowledge-base-status"
              >
                <ToggleGroupItem value="all">全部</ToggleGroupItem>
                <ToggleGroupItem value="enabled">已启用</ToggleGroupItem>
                <ToggleGroupItem value="disabled">已停用</ToggleGroupItem>
              </ToggleGroup>
            </Field>
          </div>

          {knowledgeBasesQuery.isPending ? (
            <ResourceCardsSkeleton />
          ) : knowledgeBasesQuery.isError &&
            knowledgeBasesQuery.data === undefined ? (
            <LoadError
              title="知识库加载失败"
              isRetrying={knowledgeBasesQuery.isFetching}
              onRetry={() => void knowledgeBasesQuery.refetch()}
            />
          ) : knowledgeBases.length === 0 ? (
            pageOutOfRange ? (
              <PageOutOfRange href={getKnowledgeBasesHref(1, search, status)} />
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <BookOpenIcon aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyTitle>
                    {search || status !== "all"
                      ? "未找到符合条件的知识库"
                      : "暂无知识库"}
                  </EmptyTitle>
                </EmptyHeader>
              </Empty>
            )
          ) : (
            <CardGrid busy={knowledgeBasesQuery.isFetching} label="知识库列表">
              {knowledgeBases.map((knowledgeBase) => (
                <li key={knowledgeBase.id} className="min-w-0">
                  <ResourceCard
                    name={knowledgeBase.name}
                    description={knowledgeBase.description}
                    href={`/admin/knowledge-bases/${knowledgeBase.id}`}
                    createdAt={knowledgeBase.created_at}
                    icon={BookOpenIcon}
                    status={
                      <Badge
                        variant={
                          knowledgeBase.is_enabled ? "outline" : "secondary"
                        }
                      >
                        {knowledgeBase.is_enabled ? "已启用" : "已停用"}
                      </Badge>
                    }
                    actions={
                      <>
                        <DropdownMenuItem
                          onSelect={() => setKnowledgeBaseToEdit(knowledgeBase)}
                        >
                          <PencilIcon aria-hidden="true" />
                          编辑
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={updateStatusMutation.isPending}
                          onSelect={() =>
                            changeKnowledgeBaseStatus(knowledgeBase)
                          }
                        >
                          {knowledgeBase.is_enabled ? (
                            <PowerOffIcon aria-hidden="true" />
                          ) : (
                            <PowerIcon aria-hidden="true" />
                          )}
                          {knowledgeBase.is_enabled ? "停用" : "启用"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => {
                            setKnowledgeBaseToDelete(knowledgeBase);
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
            ariaLabel="知识库分页"
            currentPage={currentPage}
            pageCount={pageCount}
            getPageHref={(page) => getKnowledgeBasesHref(page, search, status)}
          />
        </section>
      </div>

      <LibraryDialog
        kind="knowledge"
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={invalidateKnowledgeBases}
      />

      {knowledgeBaseToEdit && (
        <LibraryDialog
          kind="knowledge"
          open
          library={knowledgeBaseToEdit}
          onOpenChange={(open) => {
            if (!open) {
              setKnowledgeBaseToEdit(undefined);
            }
          }}
          onSaved={invalidateKnowledgeBases}
        />
      )}

      <DeleteDialog
        open={knowledgeBaseToDelete !== undefined}
        pending={deleteKnowledgeBaseMutation.isPending}
        title="删除知识库"
        onOpenChange={(open) => {
          if (!open) setKnowledgeBaseToDelete(undefined);
        }}
        onConfirm={() => {
          if (knowledgeBaseToDelete)
            deleteKnowledgeBaseMutation.mutate(knowledgeBaseToDelete.id);
        }}
      >
        确定删除“{knowledgeBaseToDelete?.name}”吗？此操作无法撤销。
      </DeleteDialog>
    </>
  );
}

function getStatusFilter(value: string | null): StatusFilter {
  if (value === "enabled" || value === "disabled") {
    return value;
  }

  return "all";
}

function getKnowledgeBasesHref(
  page: number,
  search: string,
  status: StatusFilter,
): string {
  const parameters = new URLSearchParams();

  if (search) {
    parameters.set("search", search);
  }

  if (status !== "all") {
    parameters.set("status", status);
  }

  return getPaginationHref("/admin/knowledge-bases", page, parameters);
}
