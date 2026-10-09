"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckIcon, CircleHelpIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { ConnectionConfig } from "@/app/admin/(project)/mcp/_components/connection-config";
import { LoadError } from "@/components/common/load-error";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { mcpKeysReadProjectMcpTools } from "@/lib/client";
import { getQueryViewState } from "@/lib/query-view-state";

export function AccessHelpDialog({
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

  const viewState = getQueryViewState(toolsQuery);

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
            {viewState === "loading" && <Skeleton className="h-64 w-full" />}
            {viewState === "error" && (
              <LoadError
                title="工具清单加载失败"
                isRetrying={toolsQuery.isFetching}
                onRetry={() => void toolsQuery.refetch()}
              />
            )}
            {toolsQuery.data && (
              <section
                className="flex flex-col gap-2"
                aria-label="知识库工具权限"
              >
                <h2 className="text-sm font-medium">知识库</h2>
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
                      .filter((tool) => tool.group === "knowledge")
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
                              <CheckIcon
                                className="mx-auto size-4"
                                aria-hidden="true"
                              />
                            ) : (
                              <XIcon
                                className="mx-auto size-4 text-muted-foreground"
                                aria-hidden="true"
                              />
                            )}
                            <span className="sr-only">
                              {readOnly ? "可使用" : "不可使用"}
                            </span>
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
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
