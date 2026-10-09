"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { MoreHorizontalIcon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { FilterGroup } from "@/app/admin/_components/filter-group";
import { useProject } from "@/app/admin/_components/project-context";
import { ButtonContent } from "@/components/common/button-content";
import { CollectionContent } from "@/components/common/collection-content";
import { DeleteDialog } from "@/components/common/delete-dialog";
import { LoadError } from "@/components/common/load-error";
import { PagePagination } from "@/components/common/page-pagination";
import { SearchToolbar } from "@/components/common/search-toolbar";
import { TableEmptyRow } from "@/components/common/table-empty-row";
import { TableSkeletonBody } from "@/components/common/table-skeleton";
import { AppHeader } from "@/components/layout/app-header";
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
import { ToggleGroupItem } from "@/components/ui/toggle-group";
import { useActionFocus } from "@/hooks/use-action-focus";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useListParams } from "@/hooks/use-list-params";
import { usePaginationScrollReset } from "@/hooks/use-pagination-scroll-reset";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  projectsReadMembers,
  projectsRemoveMember,
  projectsUpdateMember,
  type MemberPublic,
  type ProjectRole,
} from "@/lib/client";
import { getPaginationHref, parsePage } from "@/lib/pagination";
import { getQueryViewState } from "@/lib/query-view-state";

import { AddMembersDialog } from "./add-members-dialog";
import { InviteMemberDialog } from "./invite-member-dialog";

export function MemberManager() {
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const { rememberActionTrigger, restoreActionFocus } =
    useActionFocus(createButtonRef);

  const project = useProject()!;
  const user = useCurrentUser()!;
  const canManage = user.is_superuser || project.role === "admin";
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

  const isLeaving = deleting?.user_id === user.id;
  const removeLabel = isLeaving ? "退出项目" : "移出项目";

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
    mutationFn: (id: string) =>
      projectsRemoveMember({
        path: { project_id: project.id, user_id: id },
        throwOnError: true,
      }),
    onSuccess: (_, id) => {
      if (id === user.id) {
        localStorage.removeItem(`last-project:${user.id}`);
        window.location.replace(user.is_superuser ? "/admin/manage" : "/admin");

        return;
      }

      setDeleting(undefined);
      refresh();
      toast.success("成员已移出");
    },
    onError: (error, id) =>
      toast.error(
        getApiErrorMessage(error, id === user.id ? "退出项目失败" : "移出失败"),
      ),
  });

  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: ProjectRole }) =>
      projectsUpdateMember({
        path: { project_id: project.id, user_id: id },
        body: { role },
        throwOnError: true,
      }),
    onSuccess: () => {
      refresh();
      toast.success("角色已更新");
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "角色更新失败")),
  });

  return (
    <>
      <AppHeader title="项目成员" />

      <main
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6"
      >
        <section className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-6">
          {canManage && (
            <div className="flex flex-wrap gap-2">
              <Button
                ref={createButtonRef}
                onPointerDown={rememberActionTrigger}
                onFocus={rememberActionTrigger}
                onClick={() => setAdding(true)}
              >
                添加成员
              </Button>
              <InviteMemberDialog key={project.id} project={project} />
            </div>
          )}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <SearchToolbar
              value={search}
              isPending={query.isFetching}
              maxLength={100}
              onSearch={(value) => {
                if (value === search) void query.refetch();
                else update({ search: value });
              }}
              label="搜索账号或姓名…"
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
                    <TableHead>姓名 / 账号</TableHead>
                    <TableHead className="w-36">项目角色</TableHead>
                    <TableHead className="w-16">操作</TableHead>
                  </TableRow>
                </TableHeader>
                {viewState === "loading" ? (
                  <TableSkeletonBody columns={3} />
                ) : (
                  <TableBody>
                    {query.data?.data.length === 0 && (
                      <TableEmptyRow colSpan={3}>
                        {search || role ? "未找到符合条件的成员" : "暂无成员"}
                      </TableEmptyRow>
                    )}

                    {query.data?.data.map((member) => {
                      const isSelf = member.user_id === user.id;
                      const isUpdating =
                        changeRole.isPending &&
                        changeRole.variables?.id === member.user_id;

                      return (
                        <TableRow key={member.user_id}>
                          <TableCell>
                            <div className="truncate font-medium">
                              {member.full_name || member.username}
                            </div>
                            {member.full_name && (
                              <div
                                className="max-w-48 truncate text-xs text-muted-foreground"
                                title={member.username}
                              >
                                {member.username}
                              </div>
                            )}
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
                            {(isSelf ||
                              user.is_superuser ||
                              (canManage && member.role === "member")) && (
                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  asChild
                                  onPointerDown={rememberActionTrigger}
                                  onFocus={rememberActionTrigger}
                                >
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label={`${member.full_name || member.username} 的操作`}
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
                                      onSelect={() => {
                                        remove.reset();
                                        setDeleting(member);
                                      }}
                                    >
                                      {isSelf ? "退出项目" : "移出项目"}
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
            pending={query.data === undefined || query.isPlaceholderData}
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
        pending={remove.isPending || (isLeaving && remove.isSuccess)}
        title={removeLabel}
        confirmLabel={removeLabel}
        onOpenChange={(open) => {
          if (!open) setDeleting(undefined);
        }}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting.user_id);
        }}
      >
        {isLeaving ? (
          <>确定退出「{project.name}」吗？</>
        ) : (
          <>
            将“{deleting?.full_name || deleting?.username}”移出“{project.name}”？
            账号、资料和项目密钥保留。
          </>
        )}
      </DeleteDialog>
    </>
  );
}
