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
  AlertCircleIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  UsersIcon,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { UserCreateDialog } from "@/components/user-create-dialog";
import { UserEditDialog } from "@/components/user-edit-dialog";
import { AppHeader } from "@/components/app-header";
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
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
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
  CURRENT_USER_QUERY_KEY,
  useCurrentUser,
} from "@/components/user-info";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  getPaginationHref,
  getPaginationPages,
  PAGINATION_ELLIPSIS,
} from "@/lib/pagination";
import {
  type UserPublic,
  usersDeleteUser,
  usersReadUsers,
} from "@/lib/client";

const PAGE_SIZE = 20;

const USERS_QUERY_KEY = ["admin-users"] as const;

const EMPTY_USERS: UserPublic[] = [];

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

  const pageParameter = Number(searchParams.get("page"));
  const currentPage =
    Number.isInteger(pageParameter) && pageParameter > 0 ? pageParameter : 1;
  const pageIndex = currentPage - 1;

  const [createOpen, setCreateOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<UserPublic>();
  const [userToDelete, setUserToDelete] = useState<UserPublic>();

  const usersQuery = useQuery({
    queryKey: [...USERS_QUERY_KEY, pageIndex],
    queryFn: async ({ signal }) => {
      const { data } = await usersReadUsers({
        query: {
          skip: pageIndex * PAGE_SIZE,
          limit: PAGE_SIZE,
        },
        signal,
        throwOnError: true,
      });

      return data;
    },
    placeholderData: keepPreviousData,
    retry: false,
  });

  const deleteUser = useMutation({
    mutationFn: async (userId: string): Promise<void> => {
      await usersDeleteUser({
        path: { user_id: userId },
        throwOnError: true,
      });
    },
    onSuccess: async () => {
      if (usersQuery.data?.data.length === 1 && currentPage > 1) {
        router.replace(getUsersHref(currentPage - 1));
      }

      setUserToDelete(undefined);

      await queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    },
  });

  const resetDelete = deleteUser.reset;

  const columns = useMemo(
    () =>
      userColumnHelper.columns([
        userColumnHelper.accessor("username", {
          header: "用户名",
          cell: ({ row }) => (
            <div>
              <div className="font-medium">{row.original.username}</div>
              <div className="text-muted-foreground">
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
                  <MoreHorizontalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  <DropdownMenuItem onSelect={() => setUserToEdit(row.original)}>
                    <PencilIcon />
                    编辑
                  </DropdownMenuItem>
                  {row.original.id !== currentUser?.id && (
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => {
                        resetDelete();
                        setUserToDelete(row.original);
                      }}
                    >
                      <TrashIcon />
                      删除
                    </DropdownMenuItem>
                  )}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          ),
        }),
      ]),
    [currentUser?.id, resetDelete],
  );

  const table = useTable({
    features: usersTableFeatures,
    data: usersQuery.data?.data ?? EMPTY_USERS,
    columns,
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
  const paginationPages = getPaginationPages(currentPage, pageCount);
  const loadError = usersQuery.error
    ? getApiErrorMessage(usersQuery.error, "读取用户列表失败")
    : "";
  const deleteError = deleteUser.error
    ? getApiErrorMessage(deleteUser.error, "删除用户失败")
    : "";

  async function refreshUsers(): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
  }

  async function refreshUpdatedUser(userId: string): Promise<void> {
    await refreshUsers();

    if (userId === currentUser?.id) {
      await queryClient.invalidateQueries({ queryKey: CURRENT_USER_QUERY_KEY });
    }
  }

  function closeDeleteDialog(open: boolean): void {
    if (!open && !deleteUser.isPending) {
      setUserToDelete(undefined);
    }
  }

  return (
    <>
      <AppHeader
        title={"用户"}
        left={
          <SidebarTrigger className="size-9" aria-label="切换管理菜单" />
        }
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <PlusIcon data-icon="inline-start" />
            创建用户
          </Button>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <section className="mx-auto flex min-h-full max-w-6xl flex-col gap-6">
          {usersQuery.isPending ? (
            <Skeleton className="h-64" />
          ) : loadError ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <AlertCircleIcon aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>无法读取用户</EmptyTitle>
                <EmptyDescription>{loadError}</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => usersQuery.refetch()}
                >
                  重试
                </Button>
              </EmptyContent>
            </Empty>
          ) : rows.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <UsersIcon aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>暂无用户</EmptyTitle>
                <EmptyDescription>创建用户后会显示在这里。</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
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

          {pageCount > 0 && (
            <Pagination className="mt-auto" aria-label="用户分页">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href={getUsersHref(Math.max(1, currentPage - 1))}
                    aria-disabled={!table.getCanPreviousPage()}
                    tabIndex={table.getCanPreviousPage() ? undefined : -1}
                  />
                </PaginationItem>

                {paginationPages.map((page, index) => (
                  <PaginationItem key={`${page}-${index}`}>
                    {page === PAGINATION_ELLIPSIS ? (
                      <PaginationEllipsis />
                    ) : (
                      <PaginationLink
                        href={getUsersHref(page)}
                        isActive={page === currentPage}
                      >
                        {page}
                      </PaginationLink>
                    )}
                  </PaginationItem>
                ))}

                <PaginationItem>
                  <PaginationNext
                    href={getUsersHref(Math.min(pageCount, currentPage + 1))}
                    aria-disabled={!table.getCanNextPage()}
                    tabIndex={table.getCanNextPage() ? undefined : -1}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </section>
      </div>

      <UserCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={refreshUsers}
      />

      {userToEdit && (
        <UserEditDialog
          user={userToEdit}
          onOpenChange={(open) => {
            if (!open) {
              setUserToEdit(undefined);
            }
          }}
          onUpdated={() => refreshUpdatedUser(userToEdit.id)}
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

          {deleteError && (
            <Alert variant="destructive">
              <AlertCircleIcon aria-hidden="true" />
              <AlertTitle>{deleteError}</AlertTitle>
            </Alert>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteUser.isPending}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteUser.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (userToDelete) {
                  deleteUser.mutate(userToDelete.id);
                }
              }}
            >
              {deleteUser.isPending && <Spinner data-icon="inline-start" />}
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function getUsersHref(page: number): string {
  return getPaginationHref("/admin/users", page);
}
