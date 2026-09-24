"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  BookOpenIcon,
  LayoutGridIcon,
  ListIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  PowerIcon,
  PowerOffIcon,
  TrashIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { FilterGroup } from "@/app/admin/_components/filter-group";
import { usePaginationScrollReset } from "@/hooks/use-pagination-scroll-reset";
import {
  CARD_PAGE_SIZE,
  CardGrid,
  CollectionContent,
} from "@/components/common/collection-content";
import { ButtonContent } from "@/components/common/button-content";
import { TableSkeletonBody } from "@/components/common/table-skeleton";
import {
  ResourceCard,
  ResourceCardsSkeleton,
} from "@/components/common/resource-card";
import { AppHeader } from "@/components/layout/app-header";
import { LibraryDialog } from "./library-dialog";
import { getQueryViewState } from "@/lib/query-view-state";
import { LoadError } from "@/components/common/load-error";
import { PageOutOfRange } from "@/components/common/page-out-of-range";
import { SearchToolbar } from "@/components/common/search-toolbar";
import { useActionFocus } from "@/hooks/use-action-focus";
import { useListParams } from "@/hooks/use-list-params";
import { useProject } from "@/app/admin/_components/project-context";
import { projectHref } from "@/lib/project-routes";
import { PagePagination } from "@/components/common/page-pagination";
import { DeleteDialog } from "@/components/common/delete-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
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
const VIEW_STORAGE_KEY = "knowledge-base-view";

type StatusFilter = "all" | "enabled" | "disabled";

export function KnowledgeBaseManager() {
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const { rememberActionTrigger, restoreActionFocus } =
    useActionFocus(createButtonRef);

  const router = useRouter();
  const project = useProject()!;
  const { params: searchParams, update } = useListParams();
  const getPageHref = (page: number) =>
    getPaginationHref(projectHref(project.id), page, searchParams);
  const queryClient = useQueryClient();

  const currentPage = parsePage(searchParams.get("page"));
  const scrollRef = usePaginationScrollReset<HTMLDivElement>(currentPage);
  const pageIndex = currentPage - 1;
  const search = searchParams.get("search")?.trim() ?? "";
  const status = getStatusFilter(searchParams.get("status"));

  const knowledgeBasesQuery = useQuery({
    meta: { handlesInitialError: true },
    queryKey: [
      ...KNOWLEDGE_BASES_QUERY_KEY,
      project.id,
      pageIndex,
      search,
      status,
    ],
    queryFn: async ({ signal }) => {
      const { data } = await knowledgeBasesReadKnowledgeBases({
        query: {
          project_id: project.id,
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
  const viewState = getQueryViewState(
    knowledgeBasesQuery,
    knowledgeBasesQuery.data?.data.length === 0,
  );

  const knowledgeBases =
    knowledgeBasesQuery.data?.data ?? EMPTY_KNOWLEDGE_BASES;

  function invalidateKnowledgeBases(): void {
    void queryClient.invalidateQueries({ queryKey: ["projects"] });
    void queryClient.invalidateQueries({
      queryKey: KNOWLEDGE_BASES_QUERY_KEY,
    });
  }

  const [createOpen, setCreateOpen] = useState(false);
  const [view, setView] = useState<"cards" | "list">("cards");

  useEffect(() => {
    const savedView = localStorage.getItem(VIEW_STORAGE_KEY);
    if (savedView === "cards" || savedView === "list") setView(savedView);
  }, []);

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
        router.replace(getPageHref(currentPage - 1));
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

  function renderActions(knowledgeBase: KnowledgeBasePublic) {
    return (
      <>
        <DropdownMenuItem onSelect={() => setKnowledgeBaseToEdit(knowledgeBase)}>
          <PencilIcon aria-hidden="true" />
          编辑
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={updateStatusMutation.isPending}
          onSelect={() => updateStatusMutation.mutate(knowledgeBase)}
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
          onSelect={() => setKnowledgeBaseToDelete(knowledgeBase)}
        >
          <TrashIcon aria-hidden="true" />
          删除
        </DropdownMenuItem>
      </>
    );
  }

  return (
    <>
      <AppHeader
        title="知识库"
        actions={
          <Button
            ref={createButtonRef}
            onPointerDown={rememberActionTrigger}
            onFocus={rememberActionTrigger}
            aria-label="创建知识库"
            onClick={() => setCreateOpen(true)}
          >
            <PlusIcon data-icon="inline-start" aria-hidden="true" />
            <span className="hidden sm:inline">创建知识库</span>
          </Button>
        }
      />

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6"
      >
        <section className="mx-auto flex min-h-full max-w-6xl flex-col gap-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <SearchToolbar
              value={search}
              isPending={knowledgeBasesQuery.isFetching}
              maxLength={100}
              onSearch={(value) => {
                if (value === search) void knowledgeBasesQuery.refetch();
                else update({ search: value });
              }}
              label="搜索当前项目的知识库…"
            />

            <FilterGroup
              label="状态"
              value={status}
              onValueChange={(value) =>
                update({ status: value === "all" ? "" : value })
              }
            >
              <ToggleGroupItem value="all">全部</ToggleGroupItem>
              <ToggleGroupItem value="enabled">已启用</ToggleGroupItem>
              <ToggleGroupItem value="disabled">已停用</ToggleGroupItem>
            </FilterGroup>
          </div>

          <div className="flex flex-1 flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">
                {knowledgeBasesQuery.data
                  ? `共 ${knowledgeBasesQuery.data.count} 个知识库`
                  : "知识库"}
              </span>
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={view}
                aria-label="展示方式"
                onValueChange={(value) => {
                  if (value === "cards" || value === "list") {
                    setView(value);
                    localStorage.setItem(VIEW_STORAGE_KEY, value);
                  }
                }}
              >
                <ToggleGroupItem value="cards" aria-label="卡片视图" title="卡片视图">
                  <LayoutGridIcon aria-hidden="true" />
                </ToggleGroupItem>
                <ToggleGroupItem value="list" aria-label="列表视图" title="列表视图">
                  <ListIcon aria-hidden="true" />
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {viewState === "loading" ? (
              view === "cards" ? (
                <ResourceCardsSkeleton showMetadata />
              ) : (
                <Table loading>
                  <TableHeader>
                    <TableRow>
                      <TableHead>知识库</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>创建时间</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableSkeletonBody columns={4} />
                </Table>
              )
            ) : viewState === "error" ? (
              <LoadError
                title="知识库加载失败"
                isRetrying={knowledgeBasesQuery.isFetching}
                onRetry={() => void knowledgeBasesQuery.refetch()}
              />
            ) : knowledgeBases.length === 0 ? (
              pageOutOfRange ? (
                <PageOutOfRange href={getPageHref(1)} />
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
            ) : view === "cards" ? (
              <CardGrid
                inert={
                  viewState === "ready" && knowledgeBasesQuery.isPlaceholderData
                }
                busy={knowledgeBasesQuery.isFetching}
                label="知识库列表"
              >
                {knowledgeBases.map((knowledgeBase) => (
                  <li key={knowledgeBase.id} className="min-w-0">
                    <ResourceCard
                      onTriggerInteraction={rememberActionTrigger}
                      pending={
                        updateStatusMutation.isPending &&
                        updateStatusMutation.variables?.id === knowledgeBase.id
                      }
                      name={knowledgeBase.name}
                      description={knowledgeBase.description}
                      href={`${projectHref(project.id)}/${knowledgeBase.id}`}
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
                      actions={renderActions(knowledgeBase)}
                    />
                  </li>
                ))}
              </CardGrid>
            ) : (
              <CollectionContent
                inert={viewState === "ready" && knowledgeBasesQuery.isPlaceholderData}
                busy={knowledgeBasesQuery.isFetching}
              >
                <Table className="min-w-[640px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>知识库</TableHead>
                      <TableHead className="w-24">状态</TableHead>
                      <TableHead className="w-40">创建时间</TableHead>
                      <TableHead className="w-16">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {knowledgeBases.map((knowledgeBase) => {
                      const pending =
                        updateStatusMutation.isPending &&
                        updateStatusMutation.variables?.id === knowledgeBase.id;

                      return (
                        <TableRow key={knowledgeBase.id}>
                          <TableCell className="min-w-0">
                            <Link
                              className="block truncate font-medium hover:underline"
                              href={`${projectHref(project.id)}/${knowledgeBase.id}`}
                              title={knowledgeBase.name}
                            >
                              {knowledgeBase.name}
                            </Link>
                            <p className="truncate text-muted-foreground">
                              {knowledgeBase.description || "暂无描述"}
                            </p>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                knowledgeBase.is_enabled ? "outline" : "secondary"
                              }
                            >
                              {knowledgeBase.is_enabled ? "已启用" : "已停用"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <time dateTime={knowledgeBase.created_at}>
                              {new Date(
                                knowledgeBase.created_at,
                              ).toLocaleDateString("zh-CN", {
                                dateStyle: "medium",
                              })}
                            </time>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                asChild
                                onPointerDown={rememberActionTrigger}
                                onFocus={rememberActionTrigger}
                              >
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`${knowledgeBase.name} 的更多操作`}
                                  disabled={pending}
                                  aria-busy={pending}
                                >
                                  <ButtonContent
                                    loading={pending}
                                    icon={MoreHorizontalIcon}
                                  />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuGroup>
                                  {renderActions(knowledgeBase)}
                                </DropdownMenuGroup>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CollectionContent>
            )}
          </div>

          <PagePagination
            className="mt-auto"
            ariaLabel="知识库分页"
            currentPage={currentPage}
            pageCount={pageCount}
            getPageHref={getPageHref}
          />
        </section>
      </div>

      {createOpen && (
        <LibraryDialog
          onCloseAutoFocus={restoreActionFocus}
          projectId={project.id}
          projectName={project.name}
          onClose={() => setCreateOpen(false)}
          onSaved={invalidateKnowledgeBases}
        />
      )}

      {knowledgeBaseToEdit && (
        <LibraryDialog
          onCloseAutoFocus={restoreActionFocus}
          projectId={project.id}
          projectName={project.name}
          library={knowledgeBaseToEdit}
          onClose={() => setKnowledgeBaseToEdit(undefined)}
          onSaved={invalidateKnowledgeBases}
        />
      )}

      <DeleteDialog
        onCloseAutoFocus={restoreActionFocus}
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
        确定从“{project.name}”删除“{knowledgeBaseToDelete?.name}
        ”吗？此操作无法撤销。
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
