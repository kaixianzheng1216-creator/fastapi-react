"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ConnectionConfig } from "@/app/admin/mcp/_components/connection-config";
import { KeyEditorDialog } from "@/app/admin/mcp/_components/key-editor-dialog";
import { DeleteDialog } from "@/components/common/delete-dialog";
import { LoadError } from "@/components/common/load-error";
import { PagePagination } from "@/components/common/page-pagination";
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
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
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
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getApiErrorMessage } from "@/lib/api-error";
import { getPaginationHref, parsePage } from "@/lib/pagination";
import {
  mcpKeysDeleteMcpApiKey,
  mcpKeysReadMcpApiKeys,
  type McpApiKeyCreated,
  type McpApiKeyPublic,
  type McpScope,
} from "@/lib/client";

const KEY_QUERY_PREFIX = "mcp-api-keys";
const PAGE_SIZE = 10;
const dateFormatter = new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" });

type KeyManagerProps = { scope: McpScope; endpoint: string; serverId: string };

type EditorState =
  { kind: "create" } | { kind: "edit"; apiKey: McpApiKeyPublic };

export function KeyManager({ scope, endpoint, serverId }: KeyManagerProps) {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [editor, setEditor] = useState<EditorState | null>(null);
  const [keyToDelete, setKeyToDelete] = useState<McpApiKeyPublic | null>(null);
  const [createdKey, setCreatedKey] = useState<McpApiKeyCreated | null>(null);

  const queryKey = [KEY_QUERY_PREFIX, scope];

  const keysQuery = useQuery({
    queryKey,
    meta: { handlesInitialError: true },
    queryFn: async ({ signal }) => {
      const { data } = await mcpKeysReadMcpApiKeys({
        query: { scope },
        signal,
        throwOnError: true,
      });

      return data.data;
    },
  });

  const pageParameter = `${scope}Page`;
  const pageCount = Math.ceil((keysQuery.data?.length ?? 0) / PAGE_SIZE);
  const currentPage = Math.min(
    parsePage(searchParams.get(pageParameter)),
    Math.max(1, pageCount),
  );
  const pageStart = (currentPage - 1) * PAGE_SIZE;

  function getPageHref(page: number): string {
    return getPaginationHref(pathname, page, searchParams, pageParameter);
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

      void queryClient.invalidateQueries({ queryKey });
    },

    onError: (error) =>
      toast.error(getApiErrorMessage(error, "密钥删除失败，请重试")),
  });

  return (
    <section
      className="flex min-w-0 flex-1 flex-col gap-4"
      aria-label="密钥管理"
    >
      <div className="flex min-h-8 items-center justify-between gap-3">
        <h2 className="text-base font-semibold">密钥管理</h2>
        <Button
          type="button"
          size="sm"
          onClick={() => setEditor({ kind: "create" })}
        >
          <PlusIcon data-icon="inline-start" aria-hidden="true" />
          创建密钥
        </Button>
      </div>

      {keysQuery.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : keysQuery.isError ? (
        <LoadError
          title="密钥加载失败"
          isRetrying={keysQuery.isFetching}
          onRetry={() => void keysQuery.refetch()}
        />
      ) : keysQuery.data.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>暂无密钥</EmptyTitle>
            <EmptyDescription>
              创建密钥后，即可复制配置连接 MCP。
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <TooltipProvider>
          <Table
            className="min-w-[720px] table-fixed"
            containerClassName="rounded-lg border"
            aria-label="访问密钥列表"
          >
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead className="w-44">密钥标识</TableHead>
                <TableHead className="w-24">状态</TableHead>
                <TableHead className="w-36">创建时间</TableHead>
                <TableHead className="w-32 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {keysQuery.data
                .slice(pageStart, pageStart + PAGE_SIZE)
                .map((apiKey) => (
                  <TableRow key={apiKey.id} className="h-12">
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
                      <code>
                        {apiKey.key_prefix}••••{apiKey.key_suffix}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={apiKey.is_active ? "secondary" : "outline"}
                      >
                        {apiKey.is_active ? "已启用" : "已停用"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {dateFormatter.format(new Date(apiKey.created_at))}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label={`编辑密钥 ${apiKey.name}`}
                          onClick={() => setEditor({ kind: "edit", apiKey })}
                        >
                          编辑
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label={`删除密钥 ${apiKey.name}`}
                          onClick={() => setKeyToDelete(apiKey)}
                        >
                          删除
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TooltipProvider>
      )}

      <PagePagination
        className="mt-auto"
        ariaLabel="访问密钥分页"
        currentPage={currentPage}
        pageCount={pageCount}
        getPageHref={getPageHref}
      />

      {editor && (
        <KeyEditorDialog
          scope={scope}
          apiKey={editor.kind === "edit" ? editor.apiKey : undefined}
          onClose={() => setEditor(null)}
          onSaved={(newKey) => {
            setEditor(null);

            if (newKey) {
              setCreatedKey(newKey);
              router.replace(getPageHref(1), { scroll: false });
            }

            void queryClient.invalidateQueries({ queryKey });
          }}
        />
      )}

      {createdKey && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setCreatedKey(null);
          }}
        >
          <DialogContent
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
              serverId={serverId}
              endpoint={endpoint}
              apiKey={createdKey.key}
            />

            <DialogFooter>
              <Button type="button" onClick={() => setCreatedKey(null)}>
                我已保存
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {keyToDelete && (
        <DeleteDialog
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
