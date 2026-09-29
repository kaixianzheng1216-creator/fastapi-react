"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircleIcon, SparklesIcon } from "lucide-react";

import { ButtonContent } from "@/components/common/button-content";
import { MarkdownContent } from "@/components/common/markdown-content";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  type KnowledgeDocumentPreviewPublic,
  knowledgeDocumentsGenerateDocumentSummary,
} from "@/lib/client";

export function DocumentSummary({
  documentId,
  summary,
}: {
  documentId: string;
  summary: string | null;
}) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      knowledgeDocumentsGenerateDocumentSummary({
        path: { document_id: documentId },
        throwOnError: true,
      }),
    onSuccess: ({ data }) => {
      queryClient.setQueryData<KnowledgeDocumentPreviewPublic>(
        ["knowledge-document-preview", documentId],
        (preview) => preview && { ...preview, summary: data.content },
      );
    },
  });

  let actionLabel = "生成总结";

  if (summary) actionLabel = "重新生成";
  else if (mutation.isError) actionLabel = "重试";

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI 总结</CardTitle>
        <CardDescription>基于当前文档生成概述和核心要点。</CardDescription>
        <CardAction>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={mutation.isPending}
            aria-busy={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            <ButtonContent loading={mutation.isPending} icon={SparklesIcon}>
              {mutation.isPending ? "正在生成…" : actionLabel}
            </ButtonContent>
          </Button>
        </CardAction>
      </CardHeader>
      {(summary || mutation.isError) && (
        <CardContent className="flex flex-col gap-4">
          {mutation.isError && (
            <Alert variant="destructive">
              <AlertCircleIcon aria-hidden="true" />
              <AlertDescription>
                {getApiErrorMessage(mutation.error, "AI 总结生成失败，请重试")}
              </AlertDescription>
            </Alert>
          )}
          {summary && (
            <MarkdownContent className="max-w-none">{summary}</MarkdownContent>
          )}
        </CardContent>
      )}
    </Card>
  );
}
