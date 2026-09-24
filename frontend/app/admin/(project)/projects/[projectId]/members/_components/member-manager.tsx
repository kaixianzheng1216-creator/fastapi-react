"use client";

import { useRouter, usePathname } from "next/navigation";
import { useRef, useState } from "react";
import {
  keepPreviousData,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { MoreHorizontalIcon, PlusIcon, UsersIcon } from "lucide-react";
import { toast } from "sonner";

import {
  projectsReadMembers,
  projectsRemoveMember,
  projectsUpdateMember,
  type MemberPublic,
  type ProjectRole,
} from "@/lib/client";
import { FilterGroup } from "@/app/admin/_components/filter-group";
import { getApiErrorMessage } from "@/lib/api-error";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useActionFocus } from "@/hooks/use-action-focus";
import { useListParams } from "@/hooks/use-list-params";
import { usePaginationScrollReset } from "@/hooks/use-pagination-scroll-reset";
import { useProject } from "@/app/admin/_components/project-context";
import { AppHeader } from "@/components/layout/app-header";
import { SearchToolbar } from "@/components/common/search-toolbar";
import { PageOutOfRange } from "@/components/common/page-out-of-range";
import { PagePagination } from "@/components/common/page-pagination";
import { DeleteDialog } from "@/components/common/delete-dialog";
import { getQueryViewState } from "@/lib/query-view-state";
import { LoadError } from "@/components/common/load-error";
import { TableSkeletonBody } from "@/components/common/table-skeleton";
import { parsePage, getPaginationHref } from "@/lib/pagination";
import { CollectionContent } from "@/components/common/collection-content";
import { ButtonContent } from "@/components/common/button-content";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

import { AddMembersDialog } from "./add-members-dialog";

export function MemberManager() {
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const { rememberActionTrigger, restoreActionFocus } =
    useActionFocus(createButtonRef);

  const router = useRouter();
  const pathname = usePathname();
  const project = useProject()!;
  const user = useCurrentUser()!;
  const { params, update } = useListParams();
  const search = params.get("search") ?? "";
  const role =
    params.get("role") === "admin"
      ? "admin"
      : params.get("role") === "member"
        ? "member"
        : undefined;
  const page = parsePage(params.get("page"));
  const scrollRef = usePaginationScrollReset<HTMLElement>(page);
  const client = useQueryClient();

  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<MemberPublic>();

  const query = useQuery({
    queryKey: ["members", project.id, search, role, page],
    meta: { handlesInitialError: true },
    queryFn: async ({ signal }) =>
      (
        await projectsReadMembers({
          path: { project_id: project.id },
          query: { search, role, skip: (page - 1) * 20, limit: 20 },
          signal,
          throwOnError: true,
        })
      ).data,
    placeholderData: keepPreviousData,
  });
  const viewState = getQueryViewState(query, query.data?.data.length === 0);

  function refresh() {
    for (const key of ["members", "member-candidates", "projects", "project"])
      void client.invalidateQueries({ queryKey: [key] });
  }

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await projectsRemoveMember({
        path: { project_id: project.id, user_id: id },
        throwOnError: true,
      });
    },
    onSuccess: () => {
      setDeleting(undefined);
      if (query.data?.data.length === 1 && page > 1) {
        router.replace(getPaginationHref(pathname, page - 1, params), {
          scroll: false,
        });
      }
      refresh();
      toast.success("成员已移出");
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "移出失败")),
  });

  const changeRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: ProjectRole }) => {
      await projectsUpdateMember({
        path: { project_id: project.id, user_id: id },
        body: { role },
        throwOnError: true,
      });
    },
    onSuccess: () => {
      refresh();
      toast.success("角色已更新");
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "角色更新失败")),
  });

  return (
    <>
      <AppHeader
        title="项目成员"
        actions={
          <Button
            ref={createButtonRef}
            onPointerDown={rememberActionTrigger}
            onFocus={rememberActionTrigger}
            onClick={() => setAdding(true)}
          >
            <PlusIcon data-icon="inline-start" />
            添加成员
          </Button>
        }
      />
      <main
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6"
      >
        <section className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <SearchToolbar
              value={search}
              isPending={query.isFetching}
              maxLength={100}
              onSearch={(value) => {
                if (value === search) void query.refetch();
                else update({ search: value });
              }}
              label="搜索成员账号或姓名…"
            />
            <FilterGroup
              label="角色"
              value={role ?? "all"}
              onValueChange={(value) => {
                update({ role: value === "all" ? "" : value });
              }}
            >
              <ToggleGroupItem value="all">全部</ToggleGroupItem>
              <ToggleGroupItem value="admin">项目管理员</ToggleGroupItem>
              <ToggleGroupItem value="member">普通成员</ToggleGroupItem>
            </FilterGroup>
          </div>
          {viewState === "error" ? (
            <LoadError
              title="成员加载失败"
              isRetrying={query.isFetching}
              onRetry={() => void query.refetch()}
            />
          ) : viewState === "ready" &&
            query.data &&
            query.data.count > 0 &&
            !query.data.data.length ? (
            <PageOutOfRange
              href={getPaginationHref(
                `/admin/projects/${project.id}/members`,
                1,
                params,
              )}
            />
          ) : viewState === "ready" && query.data?.data.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <UsersIcon aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>
                  {search || role ? "未找到符合条件的成员" : "暂无成员"}
                </EmptyTitle>
              </EmptyHeader>
            </Empty>
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
                    <TableHead>账号 / 姓名</TableHead>
                    <TableHead className="w-36">项目角色</TableHead>
                    <TableHead className="w-16">操作</TableHead>
                  </TableRow>
                </TableHeader>
                {viewState === "loading" ? (
                  <TableSkeletonBody columns={3} />
                ) : (
                  <TableBody>
                    {query.data?.data.map((member) => {
                      const isUpdating =
                        changeRole.isPending &&
                        changeRole.variables?.id === member.user_id;

                      return (
                        <TableRow key={member.user_id}>
                          <TableCell>
                            <div className="truncate font-medium">
                              {member.username}
                            </div>
                            <div className="truncate text-muted-foreground">
                              {member.full_name || "未填写姓名"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                member.role === "admin"
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {member.role === "admin"
                                ? "项目管理员"
                                : "普通成员"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {(user.is_superuser ||
                              member.role === "member") && (
                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  asChild
                                  onPointerDown={rememberActionTrigger}
                                  onFocus={rememberActionTrigger}
                                >
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label={`${member.username} 的操作`}
                                    disabled={
                                      changeRole.isPending ||
                                      query.isPlaceholderData
                                    }
                                    aria-busy={isUpdating}
                                  >
                                    <ButtonContent
                                      icon={MoreHorizontalIcon}
                                      loading={isUpdating}
                                    />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuGroup>
                                    {user.is_superuser && (
                                      <DropdownMenuItem
                                        onSelect={() =>
                                          changeRole.mutate({
                                            id: member.user_id,
                                            role:
                                              member.role === "admin"
                                                ? "member"
                                                : "admin",
                                          })
                                        }
                                      >
                                        {member.role === "admin"
                                          ? "设为普通成员"
                                          : "设为项目管理员"}
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem
                                      variant="destructive"
                                      onSelect={() => setDeleting(member)}
                                    >
                                      移出项目
                                    </DropdownMenuItem>
                                  </DropdownMenuGroup>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                )}
              </Table>
            </CollectionContent>
          )}
          <PagePagination
            className="mt-auto"
            currentPage={page}
            pageCount={Math.ceil((query.data?.count ?? 0) / 20)}
            getPageHref={(page) =>
              getPaginationHref(
                `/admin/projects/${project.id}/members`,
                page,
                params,
              )
            }
            ariaLabel="成员分页"
          />
        </section>
      </main>
      {adding && (
        <AddMembersDialog
          project={project}
          onAdded={refresh}
          onClose={() => setAdding(false)}
          onCloseAutoFocus={restoreActionFocus}
        />
      )}
      <DeleteDialog
        onCloseAutoFocus={restoreActionFocus}
        open={!!deleting}
        pending={remove.isPending}
        title="移出项目"
        onOpenChange={(open) => {
          if (!open) setDeleting(undefined);
        }}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting.user_id);
        }}
      >
        将“{deleting?.username}”移出“{project.name}”？账号、资料和项目密钥保留。
      </DeleteDialog>
    </>
  );
}
