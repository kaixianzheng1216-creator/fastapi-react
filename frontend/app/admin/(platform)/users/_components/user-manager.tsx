"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  PowerIcon,
  PowerOffIcon,
  TrashIcon,
  UsersIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { FilterGroup } from "@/app/admin/_components/filter-group";
import { UserCreateDialog } from "@/app/admin/(platform)/users/_components/user-create-dialog";
import { UserEditDialog } from "@/app/admin/(platform)/users/_components/user-edit-dialog";
import { CollectionContent } from "@/components/common/collection-content";
import { AppHeader } from "@/components/layout/app-header";
import { getQueryViewState } from "@/lib/query-view-state";
import { LoadError } from "@/components/common/load-error";
import { PageOutOfRange } from "@/components/common/page-out-of-range";
import { PagePagination } from "@/components/common/page-pagination";
import { SearchToolbar } from "@/components/common/search-toolbar";
import { useActionFocus } from "@/hooks/use-action-focus";
import { useListParams } from "@/hooks/use-list-params";
import { usePaginationScrollReset } from "@/hooks/use-pagination-scroll-reset";
import { DeleteDialog } from "@/components/common/delete-dialog";
import { Badge } from "@/components/ui/badge";
import { ButtonContent } from "@/components/common/button-content";
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
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { TableSkeletonBody } from "@/components/common/table-skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  CURRENT_USER_QUERY_KEY,
  useCurrentUser,
} from "@/hooks/use-current-user";
import { getApiErrorMessage } from "@/lib/api-error";
import { getPaginationHref, parsePage } from "@/lib/pagination";
import {
  type UserPublic,
  usersDeleteUser,
  usersReadUsers,
  usersUpdateUser,
} from "@/lib/client";
import { toast } from "sonner";

const PAGE_SIZE = 20;

const USERS_QUERY_KEY = ["admin-users"] as const;

type RoleFilter = "all" | "admin" | "user";
type StatusFilter = "all" | "enabled" | "disabled";

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
});

export function UserManager() {
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const { rememberActionTrigger, restoreActionFocus } =
    useActionFocus(createButtonRef);

  const router = useRouter();
  const { params: searchParams, update } = useListParams();
  const getPageHref = (page: number) =>
    getPaginationHref("/admin/users", page, searchParams);
  const queryClient = useQueryClient();
  const currentUser = useCurrentUser();

  const currentPage = parsePage(searchParams.get("page"));
  const scrollRef = usePaginationScrollReset<HTMLElement>(currentPage);
  const pageIndex = currentPage - 1;
  const search = searchParams.get("search")?.trim() ?? "";
  const role = getRoleFilter(searchParams.get("role"));
  const status = getStatusFilter(searchParams.get("status"));

  const [createOpen, setCreateOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<UserPublic>();
  const [userToDelete, setUserToDelete] = useState<UserPublic>();

  const usersQuery = useQuery({
    meta: { handlesInitialError: true },
    queryKey: [...USERS_QUERY_KEY, pageIndex, search, role, status],
    queryFn: async ({ signal }) => {
      const { data } = await usersReadUsers({
        query: {
          skip: pageIndex * PAGE_SIZE,
          limit: PAGE_SIZE,
          search: search || undefined,
          is_superuser: role === "all" ? undefined : role === "admin",
          is_active: status === "all" ? undefined : status === "enabled",
        },
        signal,
        throwOnError: true,
      });

      return data;
    },
    placeholderData: keepPreviousData,
  });

  const viewState = getQueryViewState(
    usersQuery,
    usersQuery.data?.data.length === 0,
  );

  const updateStatusMutation = useMutation({
    mutationFn: async (user: UserPublic): Promise<void> => {
      await usersUpdateUser({
        path: { user_id: user.id },
        body: { is_active: !user.is_active },
        throwOnError: true,
      });
    },
    onSuccess: () => {
      toast.success("用户状态已更新");
      invalidateUsers();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "用户状态更新失败，请重试"));
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string): Promise<void> => {
      await usersDeleteUser({
        path: { user_id: userId },
        throwOnError: true,
      });
    },
    onSuccess: () => {
      toast.success("用户已删除");
      if (usersQuery.data?.data.length === 1 && currentPage > 1) {
        router.replace(getPageHref(currentPage - 1));
      }

      setUserToDelete(undefined);

      invalidateUsers();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "用户删除失败，请重试"));
    },
  });

  const users = usersQuery.data?.data ?? [];
  const pageCount = Math.ceil((usersQuery.data?.count ?? 0) / PAGE_SIZE);
  const pageOutOfRange =
    (usersQuery.data?.count ?? 0) > 0 && users.length === 0;

  function invalidateUsers(): void {
    for (const key of ["projects", "members", "member-candidates"])
      void queryClient.invalidateQueries({ queryKey: [key] });
    void queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
  }

  function invalidateUpdatedUser(userId: string): void {
    invalidateUsers();

    if (userId === currentUser?.id) {
      void queryClient.invalidateQueries({ queryKey: CURRENT_USER_QUERY_KEY });
    }
  }

  return (
    <>
      <AppHeader
        title="用户管理"
        actions={
          <Button
            ref={createButtonRef}
            onPointerDown={rememberActionTrigger}
            onFocus={rememberActionTrigger}
            onClick={() => setCreateOpen(true)}
          >
            <PlusIcon data-icon="inline-start" />
            创建用户
          </Button>
        }
      />

      <main ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
        <section className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <SearchToolbar
              value={search}
              isPending={usersQuery.isFetching}
              maxLength={100}
              onSearch={(value) => {
                if (value === search) void usersQuery.refetch();
                else update({ search: value });
              }}
              label="搜索账号或姓名…"
            />

            <div className="flex flex-wrap items-center gap-3">
              <FilterGroup
                label="角色"
                value={role}
                onValueChange={(value) =>
                  update({ role: value === "all" ? "" : value })
                }
              >
                <ToggleGroupItem value="all">全部</ToggleGroupItem>
                <ToggleGroupItem value="admin">超级管理员</ToggleGroupItem>
                <ToggleGroupItem value="user">普通用户</ToggleGroupItem>
              </FilterGroup>

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
          </div>

          {viewState === "error" ? (
            <LoadError
              title="用户加载失败"
              isRetrying={usersQuery.isFetching}
              onRetry={() => void usersQuery.refetch()}
            />
          ) : viewState !== "loading" && users.length === 0 ? (
            pageOutOfRange ? (
              <PageOutOfRange href={getPageHref(1)} />
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <UsersIcon aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyTitle>
                    {search || role !== "all" || status !== "all"
                      ? "未找到符合条件的用户"
                      : "暂无用户"}
                  </EmptyTitle>
                </EmptyHeader>
              </Empty>
            )
          ) : (
            <CollectionContent
              inert={viewState === "ready" && usersQuery.isPlaceholderData}
              busy={viewState !== "loading" && usersQuery.isFetching}
            >
              <Table
                loading={viewState === "loading"}
                className="min-w-[720px] table-fixed [&_tbody_tr]:h-14"
              >
                <TableHeader>
                  <TableRow>
                    <TableHead>账号 / 姓名</TableHead>
                    <TableHead className="w-28">角色</TableHead>
                    <TableHead className="w-28">状态</TableHead>
                    <TableHead className="w-44">创建时间</TableHead>
                    <TableHead className="w-16">操作</TableHead>
                  </TableRow>
                </TableHeader>
                {viewState === "loading" ? (
                  <TableSkeletonBody columns={5} />
                ) : (
                  <TableBody>
                    {users.map((user) => {
                      const isUpdating =
                        updateStatusMutation.isPending &&
                        updateStatusMutation.variables?.id === user.id;

                      return (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="max-w-md">
                              <div className="truncate font-medium">
                                {user.username}
                              </div>
                              <div className="truncate text-muted-foreground">
                                {user.full_name || "未填写姓名"}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                user.is_superuser ? "default" : "secondary"
                              }
                            >
                              {user.is_superuser ? "超级管理员" : "普通用户"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={user.is_active ? "outline" : "secondary"}
                            >
                              {user.is_active ? "已启用" : "已停用"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {user.created_at
                              ? dateFormatter.format(new Date(user.created_at))
                              : "—"}
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
                                  aria-label={`${user.username} 的更多操作`}
                                  disabled={updateStatusMutation.isPending}
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
                                  <DropdownMenuItem
                                    onSelect={() => setUserToEdit(user)}
                                  >
                                    <PencilIcon aria-hidden="true" />
                                    编辑
                                  </DropdownMenuItem>
                                  {user.id !== currentUser?.id && (
                                    <>
                                      <DropdownMenuItem
                                        disabled={updateStatusMutation.isPending}
                                        onSelect={() =>
                                          updateStatusMutation.mutate(user)
                                        }
                                      >
                                        {user.is_active ? (
                                          <PowerOffIcon aria-hidden="true" />
                                        ) : (
                                          <PowerIcon aria-hidden="true" />
                                        )}
                                        {user.is_active ? "停用" : "启用"}
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        variant="destructive"
                                        onSelect={() => setUserToDelete(user)}
                                      >
                                        <TrashIcon aria-hidden="true" />
                                        删除
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuGroup>
                              </DropdownMenuContent>
                            </DropdownMenu>
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
            ariaLabel="用户分页"
            currentPage={currentPage}
            pageCount={pageCount}
            getPageHref={getPageHref}
          />
        </section>
      </main>

      <UserCreateDialog
        onCloseAutoFocus={restoreActionFocus}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={invalidateUsers}
      />

      {userToEdit && (
        <UserEditDialog
          onCloseAutoFocus={restoreActionFocus}
          user={userToEdit}
          canChangeRole={userToEdit.id !== currentUser?.id}
          onOpenChange={(open) => {
            if (!open) {
              setUserToEdit(undefined);
            }
          }}
          onUpdated={() => invalidateUpdatedUser(userToEdit.id)}
        />
      )}

      <DeleteDialog
        onCloseAutoFocus={restoreActionFocus}
        open={userToDelete !== undefined}
        pending={deleteUserMutation.isPending}
        title="删除用户"
        onOpenChange={(open) => {
          if (!open) setUserToDelete(undefined);
        }}
        onConfirm={() => {
          if (userToDelete) deleteUserMutation.mutate(userToDelete.id);
        }}
      >
        确定删除“{userToDelete?.username}”吗？此操作无法撤销。
      </DeleteDialog>
    </>
  );
}

function getRoleFilter(value: string | null): RoleFilter {
  if (value === "admin" || value === "user") {
    return value;
  }

  return "all";
}

function getStatusFilter(value: string | null): StatusFilter {
  if (value === "enabled" || value === "disabled") {
    return value;
  }

  return "all";
}
