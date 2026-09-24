"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { MoreHorizontalIcon, KeyRoundIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState, type SyntheticEvent } from "react";
import { toast } from "sonner";

import { FilterGroup } from "@/app/admin/_components/filter-group";
import { ConnectionConfig } from "@/app/admin/(project)/mcp/_components/connection-config";
import { KeyEditorDialog } from "@/app/admin/(project)/mcp/_components/key-editor-dialog";
import { DeleteDialog } from "@/components/common/delete-dialog";
import { getQueryViewState } from "@/lib/query-view-state";
import { LoadError } from "@/components/common/load-error";
import { PageOutOfRange } from "@/components/common/page-out-of-range";
import { PagePagination } from "@/components/common/page-pagination";
import { CollectionContent } from "@/components/common/collection-content";
import { TableSkeletonBody } from "@/components/common/table-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SearchToolbar } from "@/components/common/search-toolbar";
import { useListParams } from "@/hooks/use-list-params";
import { ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { getApiErrorMessage } from "@/lib/api-error";
import { getPaginationHref, parsePage } from "@/lib/pagination";
import {
  mcpKeysDeleteMcpApiKey,
  mcpKeysReadMcpApiKeys,
  type McpApiKeyCreated,
  type McpApiKeyPublic,
  type ProjectPublic,
} from "@/lib/client";

const KEY_QUERY_PREFIX = "mcp-api-keys";
const PAGE_SIZE = 10;

const dateFormatter = new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" });

type KeyManagerProps = {
  endpoint: string;
  project: ProjectPublic;
  createOpen: boolean;
  onCreateClose: () => void;
  onCloseAutoFocus: (event: Event) => void;
  onTriggerInteraction: (event: SyntheticEvent<HTMLButtonElement>) => void;
};

export function KeyManager({
  endpoint,
  project,
  createOpen,
  onCreateClose,
  onCloseAutoFocus,
  onTriggerInteraction,
}: KeyManagerProps) {
  const showingCreatedKey = useRef(false);
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const router = useRouter();

  const [editor, setEditor] = useState<McpApiKeyPublic | null>(null);
  const [keyToDelete, setKeyToDelete] = useState<McpApiKeyPublic | null>(null);
  const [createdKey, setCreatedKey] = useState<McpApiKeyCreated | null>(null);

  const { params: searchParams, update } = useListParams();
  const search = searchParams.get("search") ?? "";
  const permissionParam = searchParams.get("permission");
  const permission =
    permissionParam === "read_only" || permissionParam === "read_write"
      ? permissionParam
      : undefined;
  const statusParam = searchParams.get("status");
  const status =
    statusParam === "enabled" || statusParam === "disabled"
      ? statusParam
      : "all";
  const currentPage = parsePage(searchParams.get("page"));

  const queryKey = [
    KEY_QUERY_PREFIX,
    project.id,
    search,
    permission,
    status,
    currentPage,
  ];

  const keysQuery = useQuery({
    queryKey,
    meta: { handlesInitialError: true },
    queryFn: async ({ signal }) => {
      const { data } = await mcpKeysReadMcpApiKeys({
        query: {
          project_id: project.id,
          skip: (currentPage - 1) * PAGE_SIZE,
          limit: PAGE_SIZE,
          search,
          permission,
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
    keysQuery,
    keysQuery.data?.data.length === 0,
  );

  const pageCount = Math.ceil((keysQuery.data?.count ?? 0) / PAGE_SIZE);

  function getPageHref(page: number): string {
    return getPaginationHref(pathname, page, searchParams);
  }

  function closeCreatedKey() {
    if (!createdKey) return;

    showingCreatedKey.current = false;
    setCreatedKey(null);
    if (createdKey.project_id !== project.id) {
      router.push(`/admin/projects/${createdKey.project_id}/mcp`);
    }
  }

  const deleteMutation = useMutation({
    mutationFn: async (keyId: string): Promise<void> => {
      await mcpKeysDeleteMcpApiKey({
        path: { key_id: keyId },
        throwOnError: true,
      });
    },

    onSuccess: () => {
      toast.success("密钥已删除");
      setKeyToDelete(null);

      if (keysQuery.data?.data.length === 1 && currentPage > 1)
        router.replace(getPageHref(currentPage - 1), { scroll: false });

      void queryClient.invalidateQueries({
        queryKey: [KEY_QUERY_PREFIX, project.id],
      });
    },

    onError: (error) =>
      toast.error(getApiErrorMessage(error, "密钥删除失败，请重试")),
  });

  return (
    <section
      className="flex min-w-0 flex-1 flex-col gap-6"
      aria-label="密钥管理"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SearchToolbar
          value={search}
          isPending={keysQuery.isFetching}
          maxLength={100}
          onSearch={(value) => {
            if (value === search) void keysQuery.refetch();
            else update({ search: value });
          }}
          label="搜索密钥名称…"
        />
        <div className="flex flex-wrap items-end gap-3">
          <FilterGroup
            label="权限"
            value={permission ?? "all"}
            onValueChange={(value) => {
              update({ permission: value === "all" ? "" : value });
            }}
          >
            <ToggleGroupItem value="all">全部</ToggleGroupItem>
            <ToggleGroupItem value="read_only">只读</ToggleGroupItem>
            <ToggleGroupItem value="read_write">读写</ToggleGroupItem>
          </FilterGroup>
          <FilterGroup
            label="状态"
            value={status}
            onValueChange={(value) => {
              update({ status: value === "all" ? "" : value });
            }}
          >
            <ToggleGroupItem value="all">全部</ToggleGroupItem>
            <ToggleGroupItem value="enabled">已启用</ToggleGroupItem>
            <ToggleGroupItem value="disabled">已停用</ToggleGroupItem>
          </FilterGroup>
        </div>
      </div>
      {viewState === "error" ? (
        <LoadError
          title="密钥加载失败"
          isRetrying={keysQuery.isFetching}
          onRetry={() => void keysQuery.refetch()}
        />
      ) : viewState !== "loading" &&
        keysQuery.data?.data.length === 0 &&
        (keysQuery.data.count ?? 0) > 0 ? (
        <PageOutOfRange href={getPageHref(1)} />
      ) : viewState !== "loading" && keysQuery.data?.data.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <KeyRoundIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>
              {search || permission || status !== "all"
                ? "未找到符合条件的密钥"
                : "暂无密钥"}
            </EmptyTitle>
            <EmptyDescription>
              {search || permission || status !== "all"
                ? "尝试调整搜索或筛选条件。"
                : "创建密钥后，即可复制配置连接 MCP。"}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <CollectionContent
          inert={viewState === "ready" && keysQuery.isPlaceholderData}
          busy={viewState !== "loading" && keysQuery.isFetching}
        >
          <Table
            loading={viewState === "loading"}
            className="min-w-[720px] table-fixed [&_tbody_tr]:h-14"
            aria-label="访问密钥列表"
          >
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>权限</TableHead>
                <TableHead className="w-44">密钥标识</TableHead>
                <TableHead className="w-24">状态</TableHead>
                <TableHead className="w-36">创建时间</TableHead>
                <TableHead className="w-16">操作</TableHead>
              </TableRow>
            </TableHeader>

            {viewState === "loading" ? (
              <TableSkeletonBody columns={6} />
            ) : (
              <TableBody>
                {keysQuery.data?.data.map((apiKey) => (
                  <TableRow key={apiKey.id}>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="block truncate" tabIndex={0}>
                            {apiKey.name}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs break-words">
                          {apiKey.name}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {apiKey.permission === "read_write" ? "读写" : "只读"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <code>
                        {apiKey.key_prefix}••••{apiKey.key_suffix}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={apiKey.is_active ? "outline" : "secondary"}
                      >
                        {apiKey.is_active ? "已启用" : "已停用"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {dateFormatter.format(new Date(apiKey.created_at))}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          asChild
                          onPointerDown={onTriggerInteraction}
                          onFocus={onTriggerInteraction}
                        >
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`${apiKey.name} 的操作`}
                          >
                            <MoreHorizontalIcon />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuGroup>
                            <DropdownMenuItem
                              onSelect={() => setEditor(apiKey)}
                            >
                              编辑
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => setKeyToDelete(apiKey)}
                            >
                              删除密钥
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
        ariaLabel="访问密钥分页"
        currentPage={currentPage}
        pageCount={pageCount}
        getPageHref={getPageHref}
      />

      {(createOpen || editor) && (
        <KeyEditorDialog
          onCloseAutoFocus={(event) => {
            if (showingCreatedKey.current) event.preventDefault();
            else onCloseAutoFocus(event);
          }}
          project={project}
          apiKey={editor ?? undefined}
          onClose={() => {
            setEditor(null);
            onCreateClose();
          }}
          onSaved={(newKey) => {
            setEditor(null);
            onCreateClose();

            if (newKey) {
              showingCreatedKey.current = true;
              setCreatedKey(newKey);
              if (newKey.project_id === project.id) {
                router.replace(getPageHref(1), { scroll: false });
              }
            }

            void queryClient.invalidateQueries({
              queryKey: [KEY_QUERY_PREFIX, newKey?.project_id ?? project.id],
            });
          }}
        />
      )}

      {createdKey && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) closeCreatedKey();
          }}
        >
          <DialogContent
            onCloseAutoFocus={onCloseAutoFocus}
            className="sm:max-w-2xl"
            onInteractOutside={(event) => event.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle>保存「{createdKey.name}」的连接配置</DialogTitle>
              <DialogDescription>
                完整密钥仅显示这一次。请复制并妥善保存，关闭后无法再次查看。
              </DialogDescription>
            </DialogHeader>

            <ConnectionConfig
              endpoint={endpoint}
              apiKey={createdKey.key}
            />

            <DialogFooter>
              <Button
                type="button"
                onClick={closeCreatedKey}
              >
                我已保存
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {keyToDelete && (
        <DeleteDialog
          onCloseAutoFocus={onCloseAutoFocus}
          open
          pending={deleteMutation.isPending}
          title="删除访问密钥"
          onOpenChange={(open) => {
            if (!open) setKeyToDelete(null);
          }}
          onConfirm={() => deleteMutation.mutate(keyToDelete.id)}
        >
          确定删除「{keyToDelete.name}
          」？使用此密钥的客户端将无法继续发起请求，此操作不可撤销。
        </DeleteDialog>
      )}
    </section>
  );
}
