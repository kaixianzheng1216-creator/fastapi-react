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
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";

import { UserCreateDialog } from "@/app/admin/users/_components/user-create-dialog";
import { UserEditDialog } from "@/app/admin/users/_components/user-edit-dialog";
import { AppHeader } from "@/components/layout/app-header";
import { PageOutOfRange } from "@/components/shared/page-out-of-range";
import { PagePagination } from "@/components/shared/page-pagination";
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
import { FieldLegend, FieldSet } from "@/components/ui/field";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { SidebarTrigger } from "@/components/ui/sidebar";
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

const EMPTY_USERS: UserPublic[] = [];

type RoleFilter = "all" | "admin" | "user";
type StatusFilter = "all" | "enabled" | "disabled";

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
});

const usersTableFeatures = tableFeatures({ rowPaginationFeature });

const userColumnHelper = createColumnHelper<
  typeof usersTableFeatures,
  UserPublic
>();

export function UserManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const currentUser = useCurrentUser();

  const currentPage = parsePage(searchParams.get("page"));
  const pageIndex = currentPage - 1;
  const search = searchParams.get("search")?.trim() ?? "";
  const role = getRoleFilter(searchParams.get("role"));
  const status = getStatusFilter(searchParams.get("status"));

  const [createOpen, setCreateOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<UserPublic>();
  const [userToDelete, setUserToDelete] = useState<UserPublic>();

  const usersQuery = useQuery({
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
        router.replace(getUsersHref(currentPage - 1, search, role, status));
      }

      setUserToDelete(undefined);

      invalidateUsers();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "用户删除失败，请重试"));
    },
  });

  const changeUserStatus = updateStatusMutation.mutate;

  const columns = useMemo(
    () =>
      userColumnHelper.columns([
        userColumnHelper.accessor("username", {
          header: "用户名",
          cell: ({ row }) => (
            <div className="max-w-md">
              <div className="truncate font-medium">
                {row.original.username}
              </div>
              <div className="text-muted-foreground truncate">
                {row.original.full_name || "未填写姓名"}
              </div>
            </div>
          ),
        }),
        userColumnHelper.display({
          id: "role",
          header: "角色",
          cell: ({ row }) => (
            <Badge
              variant={row.original.is_superuser ? "default" : "secondary"}
            >
              {row.original.is_superuser ? "管理员" : "普通用户"}
            </Badge>
          ),
        }),
        userColumnHelper.display({
          id: "status",
          header: "状态",
          cell: ({ row }) => (
            <Badge variant={row.original.is_active ? "outline" : "secondary"}>
              {row.original.is_active ? "已启用" : "已停用"}
            </Badge>
          ),
        }),
        userColumnHelper.accessor("created_at", {
          header: "创建时间",
          cell: ({ row }) =>
            row.original.created_at
              ? dateFormatter.format(new Date(row.original.created_at))
              : "—",
        }),
        userColumnHelper.display({
          id: "actions",
          header: "操作",
          cell: ({ row }) => (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`${row.original.username} 的更多操作`}
                >
                  <MoreHorizontalIcon aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    onSelect={() => setUserToEdit(row.original)}
                  >
                    <PencilIcon aria-hidden="true" />
                    编辑
                  </DropdownMenuItem>
                  {row.original.id !== currentUser?.id && (
                    <>
                      <DropdownMenuItem
                        disabled={updateStatusMutation.isPending}
                        onSelect={() => changeUserStatus(row.original)}
                      >
                        {row.original.is_active ? (
                          <PowerOffIcon aria-hidden="true" />
                        ) : (
                          <PowerIcon aria-hidden="true" />
                        )}
                        {row.original.is_active ? "停用" : "启用"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => {
                          setUserToDelete(row.original);
                        }}
                      >
                        <TrashIcon aria-hidden="true" />
                        删除
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          ),
        }),
      ]),
    [changeUserStatus, currentUser?.id, updateStatusMutation.isPending],
  );

  const table = useTable({
    features: usersTableFeatures,
    data: usersQuery.data?.data ?? EMPTY_USERS,
    columns,
    getRowId: (user) => user.id,
    manualPagination: true,
    rowCount: usersQuery.data?.count ?? 0,
    state: {
      pagination: {
        pageIndex,
        pageSize: PAGE_SIZE,
      },
    },
  });

  const pageCount = table.getPageCount();
  const rows = table.getRowModel().rows;
  const pageOutOfRange = (usersQuery.data?.count ?? 0) > 0 && rows.length === 0;

  function invalidateUsers(): void {
    void queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
  }

  function invalidateUpdatedUser(userId: string): void {
    invalidateUsers();

    if (userId === currentUser?.id) {
      void queryClient.invalidateQueries({ queryKey: CURRENT_USER_QUERY_KEY });
    }
  }

  function closeDeleteDialog(open: boolean): void {
    if (!open && !deleteUserMutation.isPending) {
      setUserToDelete(undefined);
    }
  }

  function submitSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const nextSearch = String(formData.get("search") ?? "").trim();
    router.push(getUsersHref(1, nextSearch, role, status));
  }

  function changeRole(nextRole: string): void {
    if (nextRole) {
      router.push(getUsersHref(1, search, nextRole as RoleFilter, status));
    }
  }

  function changeStatus(nextStatus: string): void {
    if (nextStatus) {
      router.push(getUsersHref(1, search, role, nextStatus as StatusFilter));
    }
  }

  return (
    <>
      <AppHeader
        title={"用户"}
        left={<SidebarTrigger className="size-9" aria-label="切换管理菜单" />}
        actions={
          <Button aria-label="创建用户" onClick={() => setCreateOpen(true)}>
            <PlusIcon data-icon="inline-start" aria-hidden="true" />
            <span className="hidden sm:inline">创建用户</span>
          </Button>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
        <section className="mx-auto flex min-h-full max-w-6xl flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SearchToolbar
              id="user-search"
              label="搜索用户名或姓名"
              placeholder="搜索用户名或姓名…"
              onSubmit={submitSearch}
              key={search}
              defaultValue={search}
            />

            <div className="flex flex-wrap items-center gap-3">
              <FieldSet className="w-auto flex-row items-center gap-3">
                <FieldLegend variant="label" className="mb-0">
                  角色
                </FieldLegend>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  value={role}
                  onValueChange={changeRole}
                  aria-label="用户角色筛选"
                >
                  <ToggleGroupItem value="all">全部</ToggleGroupItem>
                  <ToggleGroupItem value="admin">管理员</ToggleGroupItem>
                  <ToggleGroupItem value="user">普通用户</ToggleGroupItem>
                </ToggleGroup>
              </FieldSet>

              <FieldSet className="w-auto flex-row items-center gap-3">
                <FieldLegend variant="label" className="mb-0">
                  状态
                </FieldLegend>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  value={status}
                  onValueChange={changeStatus}
                  aria-label="用户状态筛选"
                >
                  <ToggleGroupItem value="all">全部</ToggleGroupItem>
                  <ToggleGroupItem value="enabled">已启用</ToggleGroupItem>
                  <ToggleGroupItem value="disabled">已停用</ToggleGroupItem>
                </ToggleGroup>
              </FieldSet>
            </div>
          </div>

          {usersQuery.isPending ? (
            <TableSkeleton columns={5} />
          ) : rows.length === 0 ? (
            pageOutOfRange ? (
              <PageOutOfRange href={getUsersHref(1, search, role, status)} />
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>暂无可显示内容</EmptyTitle>
                </EmptyHeader>
              </Empty>
            )
          ) : (
            <Table
              aria-busy={usersQuery.isFetching}
              className="transition-opacity aria-busy:pointer-events-none aria-busy:opacity-60"
            >
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder ? null : (
                          <table.FlexRender header={header} />
                        )}
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
            ariaLabel="用户分页"
            currentPage={currentPage}
            pageCount={pageCount}
            getPageHref={(page) => getUsersHref(page, search, role, status)}
          />
        </section>
      </div>

      <UserCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={invalidateUsers}
      />

      {userToEdit && (
        <UserEditDialog
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

      <AlertDialog open={!!userToDelete} onOpenChange={closeDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除用户</AlertDialogTitle>
            <AlertDialogDescription>
              确定删除“{userToDelete?.username}”吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteUserMutation.isPending}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteUserMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (userToDelete) {
                  deleteUserMutation.mutate(userToDelete.id);
                }
              }}
            >
              {deleteUserMutation.isPending && (
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

function getUsersHref(
  page: number,
  search: string,
  role: RoleFilter,
  status: StatusFilter,
): string {
  const parameters = new URLSearchParams();

  if (search) {
    parameters.set("search", search);
  }

  if (role !== "all") {
    parameters.set("role", role);
  }

  if (status !== "all") {
    parameters.set("status", status);
  }

  return getPaginationHref("/admin/users", page, parameters);
}
