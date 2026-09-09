"use client";

import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeftIcon,
  DownloadIcon,
  FileTextIcon,
  LayersIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { AppHeader } from "@/components/layout/app-header";
import { LoadError } from "@/components/shared/load-error";
import { MarkdownContent } from "@/components/shared/markdown-content";
import { PageOutOfRange } from "@/components/shared/page-out-of-range";
import { PagePagination } from "@/components/shared/page-pagination";
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
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  knowledgeDocumentsReadDocument,
  knowledgeDocumentsReadDocumentChunks,
  knowledgeDocumentsReadDocumentPreview,
} from "@/lib/client";
import {
  downloadMarkdownKnowledgeDocument,
  downloadOriginalKnowledgeDocument,
} from "@/lib/knowledge-document-download";
import { getPaginationHref, parsePage } from "@/lib/pagination";
import { getKnowledgeDirectoryHref } from "@/app/admin/knowledge-bases/_lib/navigation";
import { toast } from "sonner";

const CHUNK_PAGE_SIZE = 20;
const CHUNKS_ANCHOR = "document-chunks";
const PREVIEW_STALE_TIME_MS = 50 * 60 * 1000;

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
  });

  const viewParameter = searchParams.get("view");

  const activeView = viewParameter === "chunks" ? viewParameter : "markdown";

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

  const previewQuery = useQuery({
    meta: { handlesInitialError: true },
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
    staleTime: PREVIEW_STALE_TIME_MS,
  });

  const chunkPage = parsePage(searchParams.get("chunkPage"));

  function getChunkPageHref(page: number): string {
    const parameters = new URLSearchParams(searchParams);

    parameters.set("view", "chunks");

    return `${getPaginationHref(documentPath, page, parameters, "chunkPage")}#${CHUNKS_ANCHOR}`;
  }

  const downloadDocumentMutation = useMutation({
    mutationFn: (format: "original" | "markdown") =>
      format === "original"
        ? downloadOriginalKnowledgeDocument(documentId)
        : downloadMarkdownKnowledgeDocument(documentId),
    onSuccess: () => {
      toast.success("文档已开始下载");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "文档下载失败，请重试"));
    },
  });

  return (
    <>
      <AppHeader
        title={documentQuery.data?.filename ?? "文档预览"}
        left={
          <Button variant="ghost" size="icon-sm" asChild>
            <Link
              href={getKnowledgeDirectoryHref(
                knowledgeBaseId,
                parsePage(searchParams.get("page")),
                searchParams.get("folder") ?? undefined,
              )}
              aria-label="返回文档目录"
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
                  disabled={downloadDocumentMutation.isPending}
                  aria-busy={
                    downloadDocumentMutation.isPending &&
                    downloadDocumentMutation.variables === "original"
                  }
                  onClick={() => downloadDocumentMutation.mutate("original")}
                >
                  {downloadDocumentMutation.isPending &&
                  downloadDocumentMutation.variables === "original" ? (
                    <Spinner data-icon="inline-start" aria-hidden="true" />
                  ) : (
                    <DownloadIcon data-icon="inline-start" aria-hidden="true" />
                  )}
                  <span className="hidden sm:inline">下载原文件</span>
                </Button>
              )}
              {documentQuery.data.status === "ready" && (
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="下载 Markdown"
                  disabled={downloadDocumentMutation.isPending}
                  aria-busy={
                    downloadDocumentMutation.isPending &&
                    downloadDocumentMutation.variables === "markdown"
                  }
                  onClick={() => downloadDocumentMutation.mutate("markdown")}
                >
                  {downloadDocumentMutation.isPending &&
                  downloadDocumentMutation.variables === "markdown" ? (
                    <Spinner data-icon="inline-start" aria-hidden="true" />
                  ) : (
                    <FileTextIcon data-icon="inline-start" aria-hidden="true" />
                  )}
                  <span className="hidden sm:inline">下载 Markdown</span>
                </Button>
              )}
            </div>
          )
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          <Tabs value={activeView} onValueChange={changeView} className="gap-6">
            <TabsList>
              <TabsTrigger value="markdown">
                <FileTextIcon aria-hidden="true" />
                Markdown
              </TabsTrigger>
              <TabsTrigger value="chunks">
                <LayersIcon aria-hidden="true" />
                切片
              </TabsTrigger>
            </TabsList>

            <TabsContent value="markdown">
              {previewQuery.isPending ? (
                <div
                  role="status"
                  aria-label="正在加载文档内容"
                  className="flex flex-col gap-4"
                >
                  <Skeleton className="h-8 w-1/3" />
                  <Skeleton className="h-4" />
                  <Skeleton className="h-4" />
                  <Skeleton className="h-4 w-4/5" />
                </div>
              ) : previewQuery.isError && previewQuery.data === undefined ? (
                <LoadError
                  title="文档内容加载失败"
                  isRetrying={previewQuery.isFetching}
                  onRetry={() => void previewQuery.refetch()}
                />
              ) : !previewQuery.data ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <FileTextIcon aria-hidden="true" />
                    </EmptyMedia>
                    <EmptyTitle>暂无文档内容</EmptyTitle>
                  </EmptyHeader>
                </Empty>
              ) : (
                <MarkdownContent className="max-w-none">
                  {previewQuery.data.content}
                </MarkdownContent>
              )}
            </TabsContent>

            <TabsContent value="chunks">
              <div id={CHUNKS_ANCHOR} className="scroll-mt-4">
                <DocumentChunksView
                  documentId={documentId}
                  page={chunkPage}
                  getPageHref={getChunkPageHref}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
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
    meta: { handlesInitialError: true },
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
    placeholderData: keepPreviousData,
    staleTime: PREVIEW_STALE_TIME_MS,
  });

  if (chunksQuery.isPending) {
    return (
      <div
        role="status"
        aria-label="正在加载文档切片"
        className="flex flex-col gap-4"
      >
        {Array.from({ length: 3 }, (_, index) => (
          <Card key={index} aria-hidden="true">
            <CardHeader>
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-40" />
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (chunksQuery.isError && chunksQuery.data === undefined) {
    return (
      <LoadError
        title="文档切片加载失败"
        isRetrying={chunksQuery.isFetching}
        onRetry={() => void chunksQuery.refetch()}
      />
    );
  }

  if (!chunksQuery.data || chunksQuery.data.count === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LayersIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>暂无文档切片</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }

  if (chunksQuery.data.data.length === 0) {
    return <PageOutOfRange href={getPageHref(1)} />;
  }

  const pageCount = Math.ceil(chunksQuery.data.count / CHUNK_PAGE_SIZE);

  return (
    <div
      aria-busy={chunksQuery.isFetching}
      className="flex flex-col gap-4 transition-opacity aria-busy:pointer-events-none aria-busy:opacity-60"
    >
      {chunksQuery.data.data.map((chunk) => (
        <Card key={chunk.chunk_index} className="wrap-anywhere">
          <CardHeader>
            <CardTitle>切片 {chunk.chunk_index + 1}</CardTitle>
            <CardDescription>
              {formatChunkLocation(chunk.section_path, chunk.page_numbers)}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {chunk.image_urls.length > 0 && (
              <div className="grid gap-3 md:grid-cols-2">
                {chunk.image_urls.map((imageUrl, imageIndex) => (
                  <img
                    key={imageUrl}
                    src={imageUrl}
                    alt={`切片 ${chunk.chunk_index + 1} 关联图片 ${imageIndex + 1}`}
                    className="aspect-video max-h-96 w-full object-contain"
                    loading="lazy"
                    decoding="async"
                  />
                ))}
              </div>
            )}
            <p className="whitespace-pre-wrap">{chunk.content}</p>
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
