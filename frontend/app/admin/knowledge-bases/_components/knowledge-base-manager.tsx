"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircleIcon,
  BookOpenIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  PowerIcon,
  PowerOffIcon,
  TrashIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";

import { AppHeader } from "@/components/layout/app-header";
import { KnowledgeBaseDialog } from "@/app/admin/knowledge-bases/_components/knowledge-base-dialog";
import { PagePagination } from "@/app/admin/knowledge-bases/_components/page-pagination";
import { SearchToolbar } from "@/components/shared/search-toolbar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertTitle } from "@/components/ui/alert";
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
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { FieldLegend, FieldSet } from "@/components/ui/field";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  type KnowledgeBasePublic,
  knowledgeBasesDeleteKnowledgeBase,
  knowledgeBasesReadKnowledgeBases,
  knowledgeBasesUpdateKnowledgeBase,
} from "@/lib/client";
import { getPaginationHref } from "@/lib/pagination";

const PAGE_SIZE = 20;

const KNOWLEDGE_BASES_QUERY_KEY = ["admin-knowledge-bases"] as const;

type StatusFilter = "all" | "enabled" | "disabled";

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
});

export function KnowledgeBaseManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const pageParameter = Number(searchParams.get("page"));
  const currentPage =
    Number.isInteger(pageParameter) && pageParameter > 0 ? pageParameter : 1;
  const pageIndex = currentPage - 1;
  const search = searchParams.get("search")?.trim() ?? "";
  const status = getStatusFilter(searchParams.get("status"));

  const [createOpen, setCreateOpen] = useState(false);
  const [knowledgeBaseToEdit, setKnowledgeBaseToEdit] =
    useState<KnowledgeBasePublic>();
  const [knowledgeBaseToDelete, setKnowledgeBaseToDelete] =
    useState<KnowledgeBasePublic>();

  const knowledgeBasesQuery = useQuery({
    queryKey: [
      ...KNOWLEDGE_BASES_QUERY_KEY,
      pageIndex,
      search,
      status,
    ],
    queryFn: async ({ signal }) => {
      const { data } = await knowledgeBasesReadKnowledgeBases({
        query: {
          skip: pageIndex * PAGE_SIZE,
          limit: PAGE_SIZE,
          search: search || undefined,
          is_enabled:
            status === "all" ? undefined : status === "enabled",
        },
        signal,
        throwOnError: true,
      });

      return data;
    },
    retry: false,
  });

  const updateStatus = useMutation({
    mutationFn: async (knowledgeBase: KnowledgeBasePublic): Promise<void> => {
      await knowledgeBasesUpdateKnowledgeBase({
        path: { knowledge_base_id: knowledgeBase.id },
        body: { is_enabled: !knowledgeBase.is_enabled },
        throwOnError: true,
      });
    },
    onSuccess: async () => {
      await refreshKnowledgeBases();
    },
  });

  const deleteKnowledgeBase = useMutation({
    mutationFn: async (knowledgeBaseId: string): Promise<void> => {
      await knowledgeBasesDeleteKnowledgeBase({
        path: { knowledge_base_id: knowledgeBaseId },
        throwOnError: true,
      });
    },
    onSuccess: async () => {
      if (knowledgeBasesQuery.data?.data.length === 1 && currentPage > 1) {
        router.replace(
          getKnowledgeBasesHref(currentPage - 1, search, status),
        );
      }
      setKnowledgeBaseToDelete(undefined);
      await refreshKnowledgeBases();
    },
  });

  const knowledgeBases = knowledgeBasesQuery.data?.data ?? [];
  const pageCount = Math.ceil(
    (knowledgeBasesQuery.data?.count ?? 0) / PAGE_SIZE,
  );
  const loadError = knowledgeBasesQuery.error
    ? getApiErrorMessage(knowledgeBasesQuery.error, "读取知识库列表失败")
    : "";
  const statusError = updateStatus.error
    ? getApiErrorMessage(updateStatus.error, "更新知识库状态失败")
    : "";
  const deleteError = deleteKnowledgeBase.error
    ? getApiErrorMessage(deleteKnowledgeBase.error, "删除知识库失败")
    : "";

  async function refreshKnowledgeBases(): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: KNOWLEDGE_BASES_QUERY_KEY });
  }

  function submitSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const nextSearch = String(formData.get("search") ?? "").trim();
    router.push(getKnowledgeBasesHref(1, nextSearch, status));
  }

  function changeStatus(nextStatus: string): void {
    if (nextStatus) {
      router.push(
        getKnowledgeBasesHref(1, search, nextStatus as StatusFilter),
      );
    }
  }

  function closeDeleteDialog(open: boolean): void {
    if (!open && !deleteKnowledgeBase.isPending) {
      setKnowledgeBaseToDelete(undefined);
    }
  }

  return (
    <>
      <AppHeader
        title="知识库"
        left={<SidebarTrigger className="size-9" aria-label="切换管理菜单" />}
        actions={
          <Button
            aria-label="创建知识库"
            onClick={() => setCreateOpen(true)}
          >
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

            <FieldSet className="w-auto flex-row items-center gap-3">
              <FieldLegend variant="label" className="mb-0">
                状态
              </FieldLegend>
              <ToggleGroup
                type="single"
                variant="outline"
                value={status}
                onValueChange={changeStatus}
                aria-label="知识库状态筛选"
              >
                <ToggleGroupItem value="all">全部</ToggleGroupItem>
                <ToggleGroupItem value="enabled">已启用</ToggleGroupItem>
                <ToggleGroupItem value="disabled">已停用</ToggleGroupItem>
              </ToggleGroup>
            </FieldSet>
          </div>

          {statusError && (
            <Alert variant="destructive">
              <AlertCircleIcon aria-hidden="true" />
              <AlertTitle>{statusError}</AlertTitle>
            </Alert>
          )}

          {knowledgeBasesQuery.isPending ? (
            <Skeleton className="h-64" />
          ) : loadError ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <AlertCircleIcon aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>无法读取知识库</EmptyTitle>
                <EmptyDescription>{loadError}</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => knowledgeBasesQuery.refetch()}
                >
                  重试
                </Button>
              </EmptyContent>
            </Empty>
          ) : knowledgeBases.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <BookOpenIcon aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>暂无知识库</EmptyTitle>
                <EmptyDescription>
                  {search || status !== "all"
                    ? "没有符合当前条件的知识库。"
                    : "创建知识库后会显示在这里。"}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {knowledgeBases.map((knowledgeBase) => (
                  <TableRow key={knowledgeBase.id}>
                    <TableCell>
                      <div className="max-w-md">
                        <Link
                          href={`/admin/knowledge-bases/${knowledgeBase.id}`}
                          className="font-medium hover:underline"
                        >
                          {knowledgeBase.name}
                        </Link>
                        <div className="text-muted-foreground truncate">
                          {knowledgeBase.description || "暂无描述"}
                        </div>
                      </div>
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
                      {dateFormatter.format(
                        new Date(knowledgeBase.created_at),
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`${knowledgeBase.name} 的更多操作`}
                          >
                            <MoreHorizontalIcon aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuGroup>
                            <DropdownMenuItem
                              onSelect={() =>
                                setKnowledgeBaseToEdit(knowledgeBase)
                              }
                            >
                              <PencilIcon aria-hidden="true" />
                              编辑
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={updateStatus.isPending}
                              onSelect={() => updateStatus.mutate(knowledgeBase)}
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
                                deleteKnowledgeBase.reset();
                                setKnowledgeBaseToDelete(knowledgeBase);
                              }}
                            >
                              <TrashIcon aria-hidden="true" />
                              删除
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <PagePagination
            className="mt-auto"
            ariaLabel="知识库分页"
            currentPage={currentPage}
            pageCount={pageCount}
            getPageHref={(page) =>
              getKnowledgeBasesHref(page, search, status)
            }
          />
        </section>
      </div>

      <KnowledgeBaseDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={refreshKnowledgeBases}
      />

      {knowledgeBaseToEdit && (
        <KnowledgeBaseDialog
          open
          knowledgeBase={knowledgeBaseToEdit}
          onOpenChange={(open) => {
            if (!open) {
              setKnowledgeBaseToEdit(undefined);
            }
          }}
          onSaved={refreshKnowledgeBases}
        />
      )}

      <AlertDialog
        open={!!knowledgeBaseToDelete}
        onOpenChange={closeDeleteDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除知识库</AlertDialogTitle>
            <AlertDialogDescription>
              确定删除“{knowledgeBaseToDelete?.name}”吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deleteError && (
            <Alert variant="destructive">
              <AlertCircleIcon aria-hidden="true" />
              <AlertTitle>{deleteError}</AlertTitle>
            </Alert>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteKnowledgeBase.isPending}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteKnowledgeBase.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (knowledgeBaseToDelete) {
                  deleteKnowledgeBase.mutate(knowledgeBaseToDelete.id);
                }
              }}
            >
              {deleteKnowledgeBase.isPending && (
                <Spinner data-icon="inline-start" />
              )}
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
