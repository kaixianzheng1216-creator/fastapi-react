"use client";

import { useEffect, useState } from "react";

import { ConnectionConfig } from "@/app/admin/mcp/_components/connection-config";
import { KeyManager } from "@/app/admin/mcp/_components/key-manager";
import type { McpScope } from "@/lib/client";

import { AppHeader } from "@/components/layout/app-header";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type McpTool = readonly [
  name: string,
  description: string,
  access: "查询" | "写入",
];

type McpToolGroup = {
  title: string;
  tools: readonly McpTool[];
};

type ConnectionGuideProps = {
  name: string;
  serverId: string;
  description: string;
  endpoint: string;
  scope: McpScope;
  keyPlaceholder: string;
  toolGroups: readonly McpToolGroup[];
};

const BUSINESS_QUERY_TOOLS: McpTool[] = [
  ["regional_data_query", "查询品牌营销区域数据", "查询"],
  ["bilibili_ranking_query", "查询最近一次 B 站分区排行榜", "查询"],
  ["influencer_accounts_query", "查询达人账号数据", "查询"],
];

const INTERNAL_TOOL_GROUPS: McpToolGroup[] = [
  { title: "业务数据", tools: BUSINESS_QUERY_TOOLS },
  {
    title: "知识库",
    tools: [
      ["knowledge_bases_list", "查询知识库列表", "查询"],
      ["knowledge_base_create", "创建知识库", "写入"],
      ["knowledge_base_get", "查询知识库详情", "查询"],
      ["knowledge_base_update", "更新知识库及启用状态", "写入"],
      ["knowledge_base_delete", "删除知识库", "写入"],
      ["knowledge_folder_create", "创建知识库文件夹", "写入"],
      ["knowledge_folders_list", "查询知识库文件夹列表", "查询"],
      ["knowledge_folder_update", "重命名知识库文件夹", "写入"],
      ["knowledge_folder_move", "移动知识库文件夹", "写入"],
      ["knowledge_directory_list", "查询知识库目录中的文件夹和文档", "查询"],
      ["knowledge_entries_delete", "批量删除知识库文件夹和文档", "写入"],
      ["knowledge_document_upload_create", "获取知识库文档上传地址", "写入"],
      ["knowledge_document_upload_complete", "确认知识库文档上传", "写入"],
      [
        "knowledge_document_uploads_create",
        "批量获取知识库文档上传地址，每次最多 100 个",
        "写入",
      ],
      [
        "knowledge_document_uploads_complete",
        "批量确认知识库文档上传，每次最多 100 个",
        "写入",
      ],
      ["knowledge_document_get", "查询知识库文档详情", "查询"],
      ["knowledge_document_preview", "查询知识库文档预览", "查询"],
      ["knowledge_document_chunks_list", "查询知识库文档切片", "查询"],
      ["knowledge_document_download", "获取知识库原文件下载地址", "查询"],
      ["knowledge_document_move", "移动知识库文档", "写入"],
      ["knowledge_document_retry", "重试知识库文档处理", "写入"],
      ["knowledge_document_delete", "删除知识库文档", "写入"],
      ["knowledge_webpage_import", "从网页导入知识库文档", "写入"],
      ["knowledge_search", "检索知识库内容", "查询"],
    ],
  },
];

const EXTERNAL_TOOL_GROUPS: McpToolGroup[] = [
  { title: "业务数据", tools: BUSINESS_QUERY_TOOLS },
  {
    title: "知识库",
    tools: [
      ["knowledge_bases_list", "查询已启用的知识库列表", "查询"],
      ["knowledge_search", "检索已启用的知识库内容", "查询"],
    ],
  },
];

function ConnectionGuide({
  name,
  serverId,
  description,
  endpoint,
  scope,
  keyPlaceholder,
  toolGroups,
}: ConnectionGuideProps) {
  return (
    <section className="flex min-w-0 flex-1 flex-col gap-6" aria-label={name}>
      <header className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">{name}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </header>

      <Tabs defaultValue="keys" className="min-w-0 flex-1 gap-6">
        <TabsList variant="line" aria-label={`${name}内容`}>
          <TabsTrigger value="keys">密钥管理</TabsTrigger>
          <TabsTrigger value="config">连接配置</TabsTrigger>
          <TabsTrigger value="tools">可用工具</TabsTrigger>
        </TabsList>

        <TabsContent
          value="keys"
          className="min-w-0 flex-col data-[state=active]:flex"
        >
          <KeyManager scope={scope} endpoint={endpoint} serverId={serverId} />
        </TabsContent>

        <TabsContent value="config" className="min-w-0">
          <ConnectionConfig
            serverId={serverId}
            endpoint={endpoint}
            apiKey={`<${keyPlaceholder}>`}
            isTemplate
          />
        </TabsContent>

        <TabsContent
          value="tools"
          className="min-w-0 flex-col gap-4 data-[state=active]:flex"
        >
          <h2 className="flex min-h-8 items-center text-base font-semibold">
            可用工具
          </h2>

          {toolGroups.map(({ title, tools }) => (
            <section
              key={title}
              className="min-w-0 overflow-hidden rounded-lg border"
              aria-label={`${title}工具`}
            >
              <h3 className="flex items-center justify-between gap-2 border-b bg-muted/50 px-4 py-3 text-sm font-semibold">
                {title}
                <Badge variant="outline">{tools.length} 个工具</Badge>
              </h3>
              <Table className="min-w-[640px] table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-1/2 px-4 text-muted-foreground">
                      工具名称
                    </TableHead>
                    <TableHead className="px-4 text-muted-foreground">
                      用途
                    </TableHead>
                    <TableHead className="w-20 px-4 text-muted-foreground">
                      权限
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tools.map(([name, description, access]) => (
                    <TableRow key={name}>
                      <TableCell className="px-4 py-3">
                        <code>{name}</code>
                      </TableCell>
                      <TableCell className="px-4 py-3 whitespace-normal">
                        {description}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <Badge
                          variant={access === "查询" ? "secondary" : "outline"}
                        >
                          {access}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>
          ))}
        </TabsContent>
      </Tabs>
    </section>
  );
}

export default function McpPage() {
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  return (
    <>
      <AppHeader
        title="MCP 接入"
        left={<SidebarTrigger className="size-9" aria-label="切换管理菜单" />}
      />

      <main className="min-h-0 flex-1 overflow-y-auto p-4 [scrollbar-gutter:stable] md:p-6">
        <div className="mx-auto flex min-h-full max-w-4xl flex-col">
          <Tabs defaultValue="internal" className="flex-1 gap-6">
            <TabsList>
              <TabsTrigger value="internal">内部 MCP</TabsTrigger>
              <TabsTrigger value="external">外部 MCP</TabsTrigger>
            </TabsList>

            <TabsContent
              value="internal"
              className="flex-col data-[state=active]:flex"
            >
              {origin ? (
                <ConnectionGuide
                  name="内部 MCP"
                  serverId="data-hub-internal"
                  description="可查询和管理数据。"
                  endpoint={`${origin}/mcp/internal`}
                  scope="internal"
                  keyPlaceholder="内部访问密钥"
                  toolGroups={INTERNAL_TOOL_GROUPS}
                />
              ) : (
                <Skeleton className="h-64 w-full" />
              )}
            </TabsContent>

            <TabsContent
              value="external"
              className="flex-col data-[state=active]:flex"
            >
              {origin ? (
                <ConnectionGuide
                  name="外部 MCP"
                  serverId="data-hub-external"
                  description="仅可查询数据。"
                  endpoint={`${origin}/mcp/external`}
                  scope="external"
                  keyPlaceholder="外部访问密钥"
                  toolGroups={EXTERNAL_TOOL_GROUPS}
                />
              ) : (
                <Skeleton className="h-64 w-full" />
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </>
  );
}
