"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { MoreHorizontalIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { CollectionContent } from "@/components/common/collection-content";
import { DeleteDialog } from "@/components/common/delete-dialog";
import { LoadError } from "@/components/common/load-error";
import { PagePagination } from "@/components/common/page-pagination";
import { SearchToolbar } from "@/components/common/search-toolbar";
import { TableEmptyRow } from "@/components/common/table-empty-row";
import { TableSkeletonBody } from "@/components/common/table-skeleton";
import { AppHeader } from "@/components/layout/app-header";
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
import { useActionFocus } from "@/hooks/use-action-focus";
import { useListParams } from "@/hooks/use-list-params";
import { usePaginationScrollReset } from "@/hooks/use-pagination-scroll-reset";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  projectsDeleteProject,
  projectsReadProjects,
  type ProjectPublic,
} from "@/lib/client";
import { getPaginationHref, parsePage } from "@/lib/pagination";
import { projectMembersHref } from "@/lib/project-routes";
import { getQueryViewState } from "@/lib/query-view-state";
import { ProjectDialog } from "./project-dialog";

export function ProjectManager() {
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const { rememberActionTrigger, restoreActionFocus } =
    useActionFocus(createButtonRef);

  const { params, update } = useListParams();
  const search = params.get("search") ?? "";
  const page = parsePage(params.get("page"));
  const scrollRef = usePaginationScrollReset<HTMLElement>(page);
  const client = useQueryClient();

  const [editor, setEditor] = useState<ProjectPublic | "create">();
  const [deleting, setDeleting] = useState<ProjectPublic>();

  const query = useQuery({
    queryKey: ["projects", page, search],
    meta: { handlesInitialError: true },
    queryFn: async ({ signal }) =>
      (
        await projectsReadProjects({
          query: { search, skip: (page - 1) * 20, limit: 20 },
          signal,
          throwOnError: true,
        })
      ).data,
    placeholderData: keepPreviousData,
  });

  const viewState = getQueryViewState(query, query.data?.data.length === 0);

  function refresh() {
    void client.invalidateQueries({ queryKey: ["projects"] });
    void client.invalidateQueries({ queryKey: ["project"] });
  }

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await projectsDeleteProject({
        path: { project_id: id },
        throwOnError: true,
      });
    },
    onSuccess: () => {
      toast.success("项目已删除");
      setDeleting(undefined);

      refresh();
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "项目删除失败")),
  });

  return (
    <>
      <AppHeader
        title="项目管理"
        actions={
          <Button
            ref={createButtonRef}
            onPointerDown={rememberActionTrigger}
            onFocus={rememberActionTrigger}
            onClick={() => setEditor("create")}
          >
            <PlusIcon data-icon="inline-start" />
            创建项目
          </Button>
        }
      />
      <main
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6"
      >
        <section className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-6">
          <SearchToolbar
            label="搜索项目名称或描述…"
            value={search}
            isPending={query.isFetching}
            maxLength={100}
            onSearch={(value) => {
              if (value === search) void query.refetch();
              else update({ search: value });
            }}
          />
          {viewState === "error" ? (
            <LoadError
              title="项目加载失败"
              onRetry={() => void query.refetch()}
              isRetrying={query.isFetching}
            />
          ) : (
            <CollectionContent
              inert={viewState === "ready" && query.isPlaceholderData}
              busy={viewState !== "loading" && query.isFetching}
            >
              <Table
                loading={viewState === "loading"}
                className="min-w-[720px] table-fixed [&_tbody_tr]:h-14"
              >
                <TableHeader>
                  <TableRow>
                    <TableHead>项目名称</TableHead>
                    <TableHead className="w-28">成员数</TableHead>
                    <TableHead className="w-28">知识库数</TableHead>
                    <TableHead className="w-16">操作</TableHead>
                  </TableRow>
                </TableHeader>
                {viewState === "loading" ? (
                  <TableSkeletonBody columns={4} />
                ) : (
                  <TableBody>
                    {query.data?.data.length === 0 && (
                      <TableEmptyRow colSpan={4}>
                        {search ? "未找到符合条件的项目" : "暂无项目"}
                      </TableEmptyRow>
                    )}

                    {query.data?.data.map((project) => (
                      <TableRow key={project.id}>
                        <TableCell>
                          <Link
                            className="block truncate font-medium hover:underline"
                            href={projectMembersHref(project.id)}
                            title={project.name}
                          >
                            {project.name}
                          </Link>
                          {project.description && (
                            <p className="truncate text-muted-foreground">
                              {project.description}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>{project.member_count}</TableCell>
                        <TableCell>{project.knowledge_base_count}</TableCell>
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
                                aria-label={`${project.name} 的操作`}
                              >
                                <MoreHorizontalIcon />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuGroup>
                                <DropdownMenuItem asChild>
                                  <Link href={projectMembersHref(project.id)}>
                                    进入项目
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onSelect={() => setEditor(project)}
                                >
                                  编辑项目
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  variant="destructive"
                                  onSelect={() => setDeleting(project)}
                                >
                                  删除项目
                                </DropdownMenuItem>
                              </DropdownMenuGroup>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                )}
              </Table>
            </CollectionContent>
          )}
          <PagePagination
            className="mt-auto"
            currentPage={page}
            pageCount={Math.ceil((query.data?.count ?? 0) / 20)}
            pending={query.data === undefined || query.isPlaceholderData}
            getPageHref={(page) =>
              getPaginationHref("/admin/manage", page, params)
            }
            ariaLabel="项目分页"
          />
        </section>
      </main>
      {editor && (
        <ProjectDialog
          onCloseAutoFocus={restoreActionFocus}
          project={editor === "create" ? undefined : editor}
          onClose={() => setEditor(undefined)}
          onSaved={refresh}
        />
      )}
      <DeleteDialog
        onCloseAutoFocus={restoreActionFocus}
        open={!!deleting}
        pending={remove.isPending}
        title="删除项目"
        onOpenChange={(open) => {
          if (!open) setDeleting(undefined);
        }}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting.id);
        }}
      >
        确定删除“{deleting?.name}
        ”？项目必须先清空知识库，成员关系和项目密钥将一并删除。
      </DeleteDialog>
    </>
  );
}
