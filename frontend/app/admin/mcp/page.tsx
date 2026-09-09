"use client";

import { CopyIcon } from "lucide-react";
import { toast } from "sonner";

import { AppHeader } from "@/components/layout/app-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldGroup,
  FieldTitle,
} from "@/components/ui/field";
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

type ConnectionGuideProps = {
  name: string;
  serverId: string;
  description: string;
  endpoint: string;
  keyPlaceholder: string;
  tools: readonly McpTool[];
};

const BUSINESS_QUERY_TOOLS: McpTool[] = [
  ["regional_data_query", "查询品牌营销区域数据", "查询"],
  ["bilibili_ranking_query", "查询最近一次 B 站分区排行榜", "查询"],
  ["influencer_accounts_query", "查询达人账号数据", "查询"],
];

const INTERNAL_TOOLS: McpTool[] = [
  ["knowledge_bases_list", "查询知识库列表", "查询"],
  ["knowledge_base_create", "创建知识库", "写入"],
  ["knowledge_base_update", "更新知识库名称、描述或启用状态", "写入"],
  ["knowledge_base_delete", "删除知识库", "写入"],
  ["knowledge_folders_list", "查询知识库文件夹列表", "查询"],
  ["knowledge_folder_create", "创建知识库文件夹", "写入"],
  ["knowledge_folder_rename", "重命名知识库文件夹", "写入"],
  ["knowledge_folder_move", "移动知识库文件夹", "写入"],
  ["knowledge_directory_list", "查询知识库目录中的文件夹和文档", "查询"],
  ["knowledge_entries_delete", "批量删除知识库文件夹和文档", "写入"],
  ["knowledge_document_upload_create", "获取知识库文档上传地址", "写入"],
  ["knowledge_document_upload_complete", "确认知识库文档上传", "写入"],
  ["knowledge_webpage_import", "从网页导入知识库文档", "写入"],
  ["knowledge_search", "检索知识库内容", "查询"],
  ...BUSINESS_QUERY_TOOLS,
];

const EXTERNAL_TOOLS: McpTool[] = [
  ["knowledge_bases_list", "查询已启用的知识库列表", "查询"],
  ["knowledge_search", "检索已启用的知识库内容", "查询"],
  ...BUSINESS_QUERY_TOOLS,
];

function ConnectionGuide({
  name,
  serverId,
  description,
  endpoint,
  keyPlaceholder,
  tools,
}: ConnectionGuideProps) {
  const config = JSON.stringify(
    {
      mcpServers: {
        [serverId]: {
          url: endpoint,
          headers: {
            Authorization: `Bearer <${keyPlaceholder}>`,
          },
        },
      },
    },
    null,
    2,
  );

  async function copyConfig(): Promise<void> {
    try {
      await navigator.clipboard.writeText(config);
      toast.success(`${name} 配置已复制`);
    } catch {
      toast.error(`${name} 配置复制失败，请手动复制`);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{name}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" onClick={copyConfig}>
            <CopyIcon aria-hidden="true" />
            复制配置
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent>
        <FieldGroup>
          <Field>
            <FieldTitle>连接配置</FieldTitle>
            <pre className="overflow-x-auto rounded-md bg-muted p-4 text-sm leading-6">
              <code>{config}</code>
            </pre>
          </Field>

          <Field>
            <FieldTitle>可用工具</FieldTitle>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>工具名称</TableHead>
                  <TableHead>用途</TableHead>
                  <TableHead className="w-20">权限</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tools.map(([name, description, access]) => (
                  <TableRow key={name}>
                    <TableCell>
                      <code>{name}</code>
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      {description}
                    </TableCell>
                    <TableCell>
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
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}

export default function McpPage() {
  return (
    <>
      <AppHeader
        title="MCP 接入"
        left={<SidebarTrigger className="size-9" aria-label="切换管理菜单" />}
      />

      <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mx-auto max-w-4xl">
          <Tabs defaultValue="internal">
            <TabsList>
              <TabsTrigger value="internal">内部 MCP</TabsTrigger>
              <TabsTrigger value="external">外部 MCP</TabsTrigger>
            </TabsList>

            <TabsContent value="internal">
              <ConnectionGuide
                name="内部 MCP"
                serverId="data-hub-internal"
                description="可查询和管理数据。"
                endpoint="<服务地址>/mcp/internal/"
                keyPlaceholder="内部访问密钥"
                tools={INTERNAL_TOOLS}
              />
            </TabsContent>

            <TabsContent value="external">
              <ConnectionGuide
                name="外部 MCP"
                serverId="data-hub-external"
                description="仅可查询数据。"
                endpoint="<服务地址>/mcp/external/"
                keyPlaceholder="外部访问密钥"
                tools={EXTERNAL_TOOLS}
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </>
  );
}
