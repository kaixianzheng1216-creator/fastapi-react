"use client";

import { useProject } from "@/app/admin/_components/project-context";
import { usePaginationScrollReset } from "@/hooks/use-pagination-scroll-reset";
import { parsePage } from "@/lib/pagination";
import { useSearchParams } from "next/navigation";

import { useActionFocus } from "@/hooks/use-action-focus";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { ConnectionConfig } from "@/app/admin/(project)/mcp/_components/connection-config";
import { KeyManager } from "@/app/admin/(project)/mcp/_components/key-manager";
import { mcpKeysReadProjectMcpTools } from "@/lib/client";
import { CheckIcon, CircleHelpIcon, PlusIcon, XIcon } from "lucide-react";

import { AppHeader } from "@/components/layout/app-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function McpPage() {
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const { rememberActionTrigger, restoreActionFocus } =
    useActionFocus(createButtonRef);

  const [origin, setOrigin] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const project = useProject();
  const params = useSearchParams();
  const scrollRef = usePaginationScrollReset<HTMLElement>(
    parsePage(params.get("page")),
  );
  const endpoint = `${origin}/mcp/project`;

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  if (!project) return null;

  return (
    <>
      <AppHeader
        title="MCP 接入"
        actions={
          <div className="flex items-center gap-2">
            <AccessHelpDialog
              endpoint={endpoint}
              disabled={!origin}
            />
            <Button
              ref={createButtonRef}
              onPointerDown={rememberActionTrigger}
              onFocus={rememberActionTrigger}
              onClick={() => setCreateOpen(true)}
            >
              <PlusIcon data-icon="inline-start" />
              创建密钥
            </Button>
          </div>
        }
      />

      <main
        ref={scrollRef}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 md:p-6"
      >
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6">
          <KeyManager
            onTriggerInteraction={rememberActionTrigger}
            onCloseAutoFocus={restoreActionFocus}
            project={project}
            endpoint={endpoint}
            createOpen={createOpen}
            onCreateClose={() => setCreateOpen(false)}
          />
        </div>
      </main>
    </>
  );
}

function AccessHelpDialog({
  endpoint,
  disabled,
}: {
  endpoint: string;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("config");
  const toolsQuery = useQuery({
    queryKey: ["project-mcp-tools"],
    enabled: open && tab === "tools",
    meta: { handlesInitialError: true },
    queryFn: async ({ signal }) => {
      const { data } = await mcpKeysReadProjectMcpTools({
        signal,
        throwOnError: true,
      });
      return data;
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setTab("config");
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              aria-label="接入说明"
              disabled={disabled}
            >
              <CircleHelpIcon aria-hidden="true" />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>接入说明</TooltipContent>
      </Tooltip>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>接入说明</DialogTitle>
          <DialogDescription>
            创建密钥后，将连接配置粘贴到你的 MCP 客户端。
          </DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={setTab} className="min-w-0">
          <TabsList>
            <TabsTrigger value="config">接入配置</TabsTrigger>
            <TabsTrigger value="tools">工具权限</TabsTrigger>
          </TabsList>
          <TabsContent value="config" className="pt-2">
            <ConnectionConfig
              endpoint={endpoint}
              apiKey="<密钥>"
              isTemplate
            />
          </TabsContent>
          <TabsContent
            value="tools"
            className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pt-2"
          >
            {toolsQuery.isPending && <Skeleton className="h-64 w-full" />}
            {toolsQuery.isError && (
              <div
                role="alert"
                className="flex items-center justify-between gap-3"
              >
                <span className="text-sm text-muted-foreground">
                  工具清单加载失败
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toolsQuery.refetch()}
                >
                  重试
                </Button>
              </div>
            )}
            {toolsQuery.data &&
              ([
                "knowledge",
                // "business", // 业务数据工具暂不对 MCP 开放。
              ] as const).map((group) => (
                <section
                  key={group}
                  className="flex flex-col gap-2"
                  aria-label={`${group === "knowledge" ? "知识库" : "业务数据"}工具权限`}
                >
                  <h2 className="text-sm font-medium">
                    {group === "knowledge" ? "知识库" : "业务数据"}
                  </h2>
                  <Table className="min-w-[640px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>工具</TableHead>
                        <TableHead>用途</TableHead>
                        <TableHead className="w-16 text-center">只读</TableHead>
                        <TableHead className="w-16 text-center">读写</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {toolsQuery.data
                        .filter((tool) => tool.group === group)
                        .map(({ name, description, read_only: readOnly }) => (
                          <TableRow key={name}>
                            <TableCell>
                              <code>{name}</code>
                            </TableCell>
                            <TableCell className="whitespace-normal">
                              {description}
                            </TableCell>
                            <TableCell className="text-center">
                              {readOnly ? (
                                <>
                                  <CheckIcon
                                    className="mx-auto size-4"
                                    aria-hidden="true"
                                  />
                                  <span className="sr-only">可使用</span>
                                </>
                              ) : (
                                <>
                                  <XIcon
                                    className="mx-auto size-4 text-muted-foreground"
                                    aria-hidden="true"
                                  />
                                  <span className="sr-only">不可使用</span>
                                </>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <CheckIcon
                                className="mx-auto size-4"
                                aria-hidden="true"
                              />
                              <span className="sr-only">可使用</span>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </section>
              ))}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
