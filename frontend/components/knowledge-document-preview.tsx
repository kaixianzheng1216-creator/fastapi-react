"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  DownloadIcon,
  FileTextIcon,
} from "lucide-react";
import Link from "next/link";

import { AppHeader } from "@/components/app-header";
import { MarkdownContent } from "@/components/markdown-text";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiErrorMessage } from "@/lib/api-error";
import { knowledgeDocumentsReadDocumentPreview } from "@/lib/client";
import {
  downloadOriginalKnowledgeDocument,
  saveMarkdownDocument,
} from "@/lib/knowledge-document-download";

type KnowledgeDocumentPreviewProps = {
  knowledgeBaseId: string;
  documentId: string;
};

export function KnowledgeDocumentPreview({
  knowledgeBaseId,
  documentId,
}: KnowledgeDocumentPreviewProps) {
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
    retry: false,
  });
  const downloadOriginal = useMutation({
    mutationFn: downloadOriginalKnowledgeDocument,
  });

  return (
    <>
      <AppHeader
        title={previewQuery.data?.filename ?? "文档预览"}
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
          previewQuery.data && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={downloadOriginal.isPending}
                onClick={() => downloadOriginal.mutate(documentId)}
              >
                <DownloadIcon data-icon="inline-start" aria-hidden="true" />
                下载原文件
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  saveMarkdownDocument(
                    previewQuery.data.filename,
                    previewQuery.data.content,
                  )
                }
              >
                <FileTextIcon data-icon="inline-start" aria-hidden="true" />
                下载 Markdown
              </Button>
            </div>
          )
        }
      />

      <main className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 overflow-x-auto">
          {downloadOriginal.error && (
            <Alert variant="destructive">
              <AlertCircleIcon aria-hidden="true" />
              <AlertTitle>
                {getApiErrorMessage(downloadOriginal.error, "下载原文件失败")}
              </AlertTitle>
            </Alert>
          )}
          {previewQuery.isPending ? (
            <div className="flex flex-col gap-4">
              <Skeleton className="h-8 w-1/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
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
              {previewQuery.data?.content ?? ""}
            </MarkdownContent>
          )}
        </div>
      </main>
    </>
  );
}
