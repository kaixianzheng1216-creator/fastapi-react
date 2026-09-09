"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  createColumnHelper,
  rowPaginationFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import {
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  PowerIcon,
  PowerOffIcon,
  TrashIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";

import { AppHeader } from "@/components/layout/app-header";
import { KnowledgeBaseDialog } from "@/app/admin/knowledge-bases/_components/base-dialog";
import { PageOutOfRange } from "@/components/shared/page-out-of-range";
import { SearchToolbar } from "@/components/shared/search-toolbar";
import { PagePagination } from "@/components/shared/page-pagination";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldTitle } from "@/components/ui/field";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { TableSkeleton } from "@/components/shared/table-skeleton";
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
import { getPaginationHref, parsePage } from "@/lib/pagination";
import { toast } from "sonner";

const PAGE_SIZE = 20;

const KNOWLEDGE_BASES_QUERY_KEY = ["admin-knowledge-bases"] as const;
const EMPTY_KNOWLEDGE_BASES: KnowledgeBasePublic[] = [];

type StatusFilter = "all" | "enabled" | "disabled";

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
});

const knowledgeBaseTableFeatures = tableFeatures({ rowPaginationFeature });

const knowledgeBaseColumnHelper = createColumnHelper<
  typeof knowledgeBaseTableFeatures,
  KnowledgeBasePublic
>();

export function KnowledgeBaseManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const currentPage = parsePage(searchParams.get("page"));
  const pageIndex = currentPage - 1;
  const search = searchParams.get("search")?.trim() ?? "";
  const status = getStatusFilter(searchParams.get("status"));

  const knowledgeBasesQuery = useQuery({
    queryKey: [...KNOWLEDGE_BASES_QUERY_KEY, pageIndex, search, status],
    queryFn: async ({ signal }) => {
      const { data } = await knowledgeBasesReadKnowledgeBases({
        query: {
          skip: pageIndex * PAGE_SIZE,
          limit: PAGE_SIZE,
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
      toast.success("状态已更新");
      invalidateKnowledgeBases();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "更新状态失败，请重试"));
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
      toast.error(getApiErrorMessage(error, "删除失败，请重试"));
    },
  });

  function closeDeleteDialog(open: boolean): void {
    if (!open && !deleteKnowledgeBaseMutation.isPending) {
      setKnowledgeBaseToDelete(undefined);
    }
  }

  const columns = useMemo(
    () =>
      knowledgeBaseColumnHelper.columns([
        knowledgeBaseColumnHelper.accessor("name", {
          header: "名称",
          cell: ({ row }) => (
            <div className="max-w-md">
              <Link
                href={`/admin/knowledge-bases/${row.original.id}`}
                className="font-medium hover:underline"
              >
                {row.original.name}
              </Link>
              <div className="text-muted-foreground truncate">
                {row.original.description || "暂无描述"}
              </div>
            </div>
          ),
        }),
        knowledgeBaseColumnHelper.display({
          id: "status",
          header: "状态",
          cell: ({ row }) => (
            <Badge variant={row.original.is_enabled ? "outline" : "secondary"}>
              {row.original.is_enabled ? "已启用" : "已停用"}
            </Badge>
          ),
        }),
        knowledgeBaseColumnHelper.accessor("created_at", {
          header: "创建时间",
          cell: ({ row }) =>
            dateFormatter.format(new Date(row.original.created_at)),
        }),
        knowledgeBaseColumnHelper.display({
          id: "actions",
          header: "操作",
          cell: ({ row }) => (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`${row.original.name} 的更多操作`}
                >
                  <MoreHorizontalIcon aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    onSelect={() => setKnowledgeBaseToEdit(row.original)}
                  >
                    <PencilIcon aria-hidden="true" />
                    编辑
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={updateStatusMutation.isPending}
                    onSelect={() => changeKnowledgeBaseStatus(row.original)}
                  >
                    {row.original.is_enabled ? (
                      <PowerOffIcon aria-hidden="true" />
                    ) : (
                      <PowerIcon aria-hidden="true" />
                    )}
                    {row.original.is_enabled ? "停用" : "启用"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => {
                      setKnowledgeBaseToDelete(row.original);
                    }}
                  >
                    <TrashIcon aria-hidden="true" />
                    删除
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          ),
        }),
      ]),
    [changeKnowledgeBaseStatus, updateStatusMutation.isPending],
  );

  const table = useTable({
    features: knowledgeBaseTableFeatures,
    data: knowledgeBases,
    columns,
    getRowId: (knowledgeBase) => knowledgeBase.id,
    manualPagination: true,
    rowCount: knowledgeBasesQuery.data?.count ?? 0,
    state: {
      pagination: {
        pageIndex,
        pageSize: PAGE_SIZE,
      },
    },
  });

  const pageCount = table.getPageCount();
  const rows = table.getRowModel().rows;
  const pageOutOfRange =
    (knowledgeBasesQuery.data?.count ?? 0) > 0 && rows.length === 0;

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
            <TableSkeleton columns={4} />
          ) : rows.length === 0 ? (
            pageOutOfRange ? (
              <PageOutOfRange href={getKnowledgeBasesHref(1, search, status)} />
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>暂无可显示内容</EmptyTitle>
                </EmptyHeader>
              </Empty>
            )
          ) : (
            <Table
              aria-busy={knowledgeBasesQuery.isFetching}
              className="transition-opacity aria-busy:pointer-events-none aria-busy:opacity-60"
            >
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        <table.FlexRender header={header} />
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getAllCells().map((cell) => (
                      <TableCell key={cell.id}>
                        <table.FlexRender cell={cell} />
                      </TableCell>
                    ))}
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
            getPageHref={(page) => getKnowledgeBasesHref(page, search, status)}
          />
        </section>
      </div>

      <KnowledgeBaseDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={invalidateKnowledgeBases}
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
          onSaved={invalidateKnowledgeBases}
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

          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deleteKnowledgeBaseMutation.isPending}
            >
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteKnowledgeBaseMutation.isPending}
              onClick={(event) => {
                event.preventDefault();

                if (knowledgeBaseToDelete) {
                  deleteKnowledgeBaseMutation.mutate(knowledgeBaseToDelete.id);
                }
              }}
            >
              {deleteKnowledgeBaseMutation.isPending && (
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
