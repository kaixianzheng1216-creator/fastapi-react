"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  BracesIcon,
  DownloadIcon,
  FileTextIcon,
  LayersIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { AppHeader } from "@/components/layout/app-header";
import { MarkdownContent } from "@/components/shared/markdown-content";
import { PagePagination } from "@/app/admin/knowledge-bases/_components/page-pagination";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  knowledgeDocumentsReadDoclingDocument,
  knowledgeDocumentsReadDocument,
  knowledgeDocumentsReadDocumentChunks,
  knowledgeDocumentsReadDocumentPreview,
} from "@/lib/client";
import {
  downloadMarkdownKnowledgeDocument,
  downloadOriginalKnowledgeDocument,
} from "@/lib/knowledge-document-download";
import { getPaginationHref } from "@/lib/pagination";

const CHUNK_PAGE_SIZE = 20;
const MAX_INLINE_JSON_BYTES = 2 * 1024 * 1024;

type KnowledgeDocumentPreviewProps = {
  knowledgeBaseId: string;
  documentId: string;
};

export function KnowledgeDocumentPreview({
  knowledgeBaseId,
  documentId,
}: KnowledgeDocumentPreviewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const documentPath = `/admin/knowledge-bases/${knowledgeBaseId}/documents/${documentId}`;

  const viewParameter = searchParams.get("view");
  const activeView =
    viewParameter === "json" || viewParameter === "chunks"
      ? viewParameter
      : "markdown";

  const chunkPageParameter = Number(searchParams.get("chunkPage"));
  const chunkPage =
    Number.isInteger(chunkPageParameter) && chunkPageParameter > 0
      ? chunkPageParameter
      : 1;

  const documentQuery = useQuery({
    queryKey: ["knowledge-document", documentId],
    queryFn: async ({ signal }) => {
      const { data } = await knowledgeDocumentsReadDocument({
        path: { document_id: documentId },
        signal,
        throwOnError: true,
      });

      return data;
    },
    retry: false,
  });

  const previewQuery = useQuery({
    queryKey: ["knowledge-document-preview", documentId],
    queryFn: async ({ signal }) => {
      const { data } = await knowledgeDocumentsReadDocumentPreview({
        path: { document_id: documentId },
        signal,
        throwOnError: true,
      });

      return data;
    },
    enabled: activeView === "markdown",
    retry: false,
  });

  const downloadDocument = useMutation({
    mutationFn: (format: "original" | "markdown") =>
      format === "original"
        ? downloadOriginalKnowledgeDocument(documentId)
        : downloadMarkdownKnowledgeDocument(documentId),
  });

  function changeView(view: string): void {
    const parameters = new URLSearchParams(searchParams);

    if (view === "markdown") {
      parameters.delete("view");
    } else {
      parameters.set("view", view);
    }

    if (view !== "chunks") {
      parameters.delete("chunkPage");
    }

    const query = parameters.toString();

    router.replace(query ? `${documentPath}?${query}` : documentPath, {
      scroll: false,
    });
  }

  function getChunkPageHref(page: number): string {
    const parameters = new URLSearchParams(searchParams);
    parameters.set("view", "chunks");

    return getPaginationHref(documentPath, page, parameters, "chunkPage");
  }

  return (
    <>
      <AppHeader
        title={documentQuery.data?.filename ?? "文档预览"}
        left={
          <Button variant="ghost" size="icon-sm" asChild>
            <Link
              href={`/admin/knowledge-bases/${knowledgeBaseId}`}
              aria-label="返回知识库详情"
            >
              <ArrowLeftIcon aria-hidden="true" />
            </Link>
          </Button>
        }
        actions={
          documentQuery.data && (
            <div className="flex items-center gap-2">
              {documentQuery.data.uploaded && (
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="下载原文件"
                  disabled={downloadDocument.isPending}
                  onClick={() => downloadDocument.mutate("original")}
                >
                  <DownloadIcon data-icon="inline-start" aria-hidden="true" />
                  <span className="hidden sm:inline">下载原文件</span>
                </Button>
              )}
              {documentQuery.data.status === "ready" && (
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="下载 Markdown"
                  disabled={downloadDocument.isPending}
                  onClick={() => downloadDocument.mutate("markdown")}
                >
                  <FileTextIcon data-icon="inline-start" aria-hidden="true" />
                  <span className="hidden sm:inline">下载 Markdown</span>
                </Button>
              )}
            </div>
          )
        }
      />

      <div className="flex min-h-0 flex-1 p-4 md:p-6">
        <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-col gap-6">
          {downloadDocument.error && (
            <Alert variant="destructive">
              <AlertCircleIcon aria-hidden="true" />
              <AlertTitle>
                {getApiErrorMessage(downloadDocument.error, "下载文档失败")}
              </AlertTitle>
            </Alert>
          )}

          {documentQuery.error && (
            <Alert variant="destructive">
              <AlertCircleIcon aria-hidden="true" />
              <AlertTitle>
                {getApiErrorMessage(documentQuery.error, "读取文档信息失败")}
              </AlertTitle>
            </Alert>
          )}

          <Tabs
            value={activeView}
            onValueChange={changeView}
            className="min-h-0 flex-1"
          >
            <TabsList>
              <TabsTrigger value="markdown">
                <FileTextIcon aria-hidden="true" />
                Markdown
              </TabsTrigger>
              <TabsTrigger value="json">
                <BracesIcon aria-hidden="true" />
                Docling JSON
              </TabsTrigger>
              <TabsTrigger value="chunks">
                <LayersIcon aria-hidden="true" />
                切片
              </TabsTrigger>
            </TabsList>

            <TabsContent
              value="markdown"
              className="min-h-0 overflow-y-auto pt-4"
            >
              {previewQuery.isPending ? (
                <div className="flex flex-col gap-4">
                  <Skeleton className="h-8 w-1/3" />
                  <Skeleton className="h-4" />
                  <Skeleton className="h-4" />
                  <Skeleton className="h-4 w-4/5" />
                </div>
              ) : previewQuery.error ? (
                <Alert variant="destructive">
                  <AlertCircleIcon aria-hidden="true" />
                  <AlertTitle>
                    {getApiErrorMessage(previewQuery.error, "读取预览失败")}
                  </AlertTitle>
                </Alert>
              ) : (
                <MarkdownContent className="max-w-none">
                  {previewQuery.data.content}
                </MarkdownContent>
              )}
            </TabsContent>

            <TabsContent
              value="json"
              className="flex min-h-0 flex-col gap-4 pt-4"
            >
              <DoclingDocumentView documentId={documentId} />
            </TabsContent>

            <TabsContent
              value="chunks"
              className="min-h-0 overflow-y-auto pt-4"
            >
              <DocumentChunksView
                documentId={documentId}
                page={chunkPage}
                getPageHref={getChunkPageHref}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
}

function DoclingDocumentView({ documentId }: { documentId: string }) {
  const doclingDocumentQuery = useQuery({
    queryKey: ["knowledge-docling-document", documentId],
    queryFn: async ({ signal }) => {
      const { data } = await knowledgeDocumentsReadDoclingDocument({
        path: { document_id: documentId },
        signal,
        throwOnError: true,
      });

      if (data.size > MAX_INLINE_JSON_BYTES) {
        return { ...data, content: undefined };
      }

      const response = await fetch(data.downloadUrl, { signal });

      if (!response.ok) {
        throw new Error(`对象存储读取失败（${response.status}）`);
      }

      const content = JSON.stringify(await response.json(), null, 2);

      return { ...data, content };
    },
    retry: false,
  });

  if (doclingDocumentQuery.isPending) {
    return <Skeleton className="h-64" />;
  }

  if (doclingDocumentQuery.error) {
    return (
      <Alert variant="destructive">
        <AlertCircleIcon aria-hidden="true" />
        <AlertTitle>
          {getApiErrorMessage(
            doclingDocumentQuery.error,
            "读取 Docling JSON 失败",
          )}
        </AlertTitle>
      </Alert>
    );
  }

  return (
    <>
      <div className="flex justify-end">
        <Button variant="outline" size="sm" asChild>
          <a href={doclingDocumentQuery.data.downloadUrl}>
            <DownloadIcon data-icon="inline-start" aria-hidden="true" />
            下载完整 JSON
          </a>
        </Button>
      </div>

      {doclingDocumentQuery.data.content === undefined ? (
        <Empty className="min-h-0 rounded-md border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BracesIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>JSON 文件过大，无法在线预览</EmptyTitle>
            <EmptyDescription>
              请使用上方按钮下载完整 document.json。
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <pre className="min-h-0 flex-1 overflow-auto rounded-md border p-4 text-sm">
          <code>{doclingDocumentQuery.data.content}</code>
        </pre>
      )}
    </>
  );
}

function DocumentChunksView({
  documentId,
  page,
  getPageHref,
}: {
  documentId: string;
  page: number;
  getPageHref: (page: number) => string;
}) {
  const chunksQuery = useQuery({
    queryKey: ["knowledge-document-chunks", documentId, page],
    queryFn: async ({ signal }) => {
      const { data } = await knowledgeDocumentsReadDocumentChunks({
        path: { document_id: documentId },
        query: {
          skip: (page - 1) * CHUNK_PAGE_SIZE,
          limit: CHUNK_PAGE_SIZE,
        },
        signal,
        throwOnError: true,
      });

      return data;
    },
    retry: false,
  });

  if (chunksQuery.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (chunksQuery.error) {
    return (
      <Alert variant="destructive">
        <AlertCircleIcon aria-hidden="true" />
        <AlertTitle>
          {getApiErrorMessage(chunksQuery.error, "读取切片失败")}
        </AlertTitle>
      </Alert>
    );
  }

  if (chunksQuery.data.count === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LayersIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>没有切片</EmptyTitle>
          <EmptyDescription>该文档尚未生成可展示的切片。</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const pageCount = Math.ceil(chunksQuery.data.count / CHUNK_PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4">
      {chunksQuery.data.data.map((chunk) => (
        <Card key={chunk.chunk_index}>
          <CardHeader>
            <CardTitle>切片 {chunk.chunk_index + 1}</CardTitle>
            <CardDescription>
              {formatChunkLocation(chunk.section_path, chunk.page_numbers)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {chunk.content}
            </p>
          </CardContent>
        </Card>
      ))}

      <PagePagination
        ariaLabel="文档切片分页"
        currentPage={page}
        pageCount={pageCount}
        getPageHref={getPageHref}
      />
    </div>
  );
}

function formatChunkLocation(
  sectionPath: string[],
  pageNumbers: number[],
): string {
  const parts = [
    sectionPath.length > 0 ? sectionPath.join(" / ") : undefined,
    pageNumbers.length > 0 ? `第 ${pageNumbers.join("、")} 页` : undefined,
  ].filter(Boolean);

  return parts.join(" · ") || "未标注位置";
}
