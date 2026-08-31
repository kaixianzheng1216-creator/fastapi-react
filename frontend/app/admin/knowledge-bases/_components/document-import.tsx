"use client";

import { useMutation } from "@tanstack/react-query";
import { AlertCircleIcon, GlobeIcon, UploadIcon } from "lucide-react";
import { type FormEvent, useState } from "react";

import { KNOWLEDGE_DOCUMENT_UPLOAD_KEY } from "@/app/admin/knowledge-bases/_lib/directory";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  knowledgeBasesCreateDocumentUpload,
  knowledgeBasesCreateWebpageDocument,
  knowledgeDocumentsCompleteDocumentUpload,
  knowledgeDocumentsDeleteDocument,
} from "@/lib/client";
import {
  DOCUMENT_CONTENT_TYPES,
  formatFileSize,
  getFileContentType,
  MAX_FILE_SIZE,
} from "@/lib/file-types";

const UPLOAD_CONCURRENCY = 3;
const DOCUMENT_ACCEPT = DOCUMENT_CONTENT_TYPES.join(",");

export function KnowledgeDocumentImport({
  knowledgeBaseId,
  folderId,
  onDocumentsChanged,
}: {
  knowledgeBaseId: string;
  folderId?: string;
  onDocumentsChanged: () => Promise<void>;
}) {
  const [importError, setImportError] = useState<Error>();

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const uploadDocument = useMutation({
    mutationKey: [...KNOWLEDGE_DOCUMENT_UPLOAD_KEY, knowledgeBaseId],
    mutationFn: async (files: File[]): Promise<void> => {
      const validatedFiles = files.map((file) => {
        const contentType = getFileContentType(file);

        if (!contentType || !DOCUMENT_CONTENT_TYPES.includes(contentType)) {
          throw new Error(`${file.name} 的文件类型不受支持`);
        }

        if (file.size > MAX_FILE_SIZE) {
          throw new Error(`${file.name} 超过 ${formatFileSize(MAX_FILE_SIZE)}`);
        }

        return { file, contentType };
      });

      const failureMessages: string[] = [];

      for (
        let startIndex = 0;
        startIndex < validatedFiles.length;
        startIndex += UPLOAD_CONCURRENCY
      ) {
        const batch = validatedFiles.slice(
          startIndex,
          startIndex + UPLOAD_CONCURRENCY,
        );

        const results = await Promise.allSettled(
          batch.map(({ file, contentType }) =>
            uploadKnowledgeDocument(
              knowledgeBaseId,
              folderId,
              file,
              contentType,
            ),
          ),
        );

        for (const [index, result] of results.entries()) {
          if (result.status === "rejected") {
            const filename = batch[index].file.name;
            const message = getApiErrorMessage(
              result.reason,
              result.reason instanceof Error
                ? result.reason.message
                : "上传失败",
            );

            failureMessages.push(`${filename}：${message}`);
            console.error("知识库文档导入失败", {
              knowledgeBaseId,
              filename,
              error: result.reason,
            });
          }
        }
      }

      if (failureMessages.length > 0) {
        throw new Error(failureMessages.join("；"));
      }
    },
    onMutate: () => setImportError(undefined),
    onError: setImportError,

    onSettled: onDocumentsChanged,
  });

  function submitUpload(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const form = event.currentTarget;

    if (selectedFiles.length > 0) {
      uploadDocument.mutate(selectedFiles, {
        onSettled: () => {
          form.reset();

          setSelectedFiles([]);
        },
      });
    }
  }

  const [webpageUrl, setWebpageUrl] = useState("");

  const createWebpage = useMutation({
    mutationFn: (url: string) =>
      knowledgeBasesCreateWebpageDocument({
        path: { knowledge_base_id: knowledgeBaseId },
        query: { folder_id: folderId },
        body: { url },
        throwOnError: true,
      }),
    onMutate: () => setImportError(undefined),
    onError: setImportError,
    onSuccess: onDocumentsChanged,
  });

  function submitWebpage(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    createWebpage.mutate(webpageUrl, {
      onSuccess: () => setWebpageUrl(""),
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>添加文档</CardTitle>
        <CardDescription>上传本地文件，或输入公开网页地址。</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="files">
          <TabsList>
            <TabsTrigger value="files">上传文件</TabsTrigger>
            <TabsTrigger value="webpage">添加网页</TabsTrigger>
          </TabsList>

          <TabsContent
            value="files"
            forceMount
            className="data-[state=inactive]:hidden"
          >
            <form onSubmit={submitUpload}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="knowledge-document">文件</FieldLabel>
                  <FieldDescription>
                    支持 PDF、Office、HTML、Markdown、TXT、CSV 和
                    JSON。单个文件最大 {formatFileSize(MAX_FILE_SIZE)}。
                  </FieldDescription>
                  <Input
                    id="knowledge-document"
                    name="document"
                    type="file"
                    accept={DOCUMENT_ACCEPT}
                    disabled={uploadDocument.isPending}
                    multiple
                    onChange={(event) => {
                      setSelectedFiles(
                        Array.from(event.currentTarget.files ?? []),
                      );
                    }}
                    required
                  />
                  {selectedFiles.length > 0 && (
                    <FieldDescription>
                      已选择 {selectedFiles.length} 个文件
                    </FieldDescription>
                  )}
                </Field>
                <Button
                  type="submit"
                  className="self-end"
                  disabled={
                    uploadDocument.isPending || selectedFiles.length === 0
                  }
                >
                  {uploadDocument.isPending ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <UploadIcon data-icon="inline-start" aria-hidden="true" />
                  )}
                  {uploadDocument.isPending
                    ? "上传中…"
                    : selectedFiles.length > 0
                      ? `上传 ${selectedFiles.length} 个文件`
                      : "上传文件"}
                </Button>
              </FieldGroup>
            </form>
          </TabsContent>

          <TabsContent value="webpage">
            <form onSubmit={submitWebpage}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="knowledge-webpage-url">
                    网页地址
                  </FieldLabel>
                  <FieldDescription>
                    输入公开网页地址，系统会抓取正文并创建文档。
                  </FieldDescription>
                  <Input
                    id="knowledge-webpage-url"
                    name="url"
                    type="url"
                    placeholder="https://example.com/article"
                    value={webpageUrl}
                    disabled={createWebpage.isPending}
                    onChange={(event) =>
                      setWebpageUrl(event.currentTarget.value)
                    }
                    required
                  />
                </Field>
                <Button
                  type="submit"
                  className="self-end"
                  disabled={createWebpage.isPending || !webpageUrl.trim()}
                >
                  {createWebpage.isPending ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <GlobeIcon data-icon="inline-start" aria-hidden="true" />
                  )}
                  {createWebpage.isPending ? "抓取中…" : "添加网页"}
                </Button>
              </FieldGroup>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
      {importError && (
        <CardFooter>
          <Alert variant="destructive">
            <AlertCircleIcon aria-hidden="true" />
            <AlertTitle>
              {getApiErrorMessage(
                importError,
                importError instanceof Error
                  ? importError.message
                  : "添加文档失败",
              )}
            </AlertTitle>
          </Alert>
        </CardFooter>
      )}
    </Card>
  );
}

async function uploadKnowledgeDocument(
  knowledgeBaseId: string,
  folderId: string | undefined,
  file: File,
  contentType: string,
): Promise<void> {
  const { data: upload } = await knowledgeBasesCreateDocumentUpload({
    path: { knowledge_base_id: knowledgeBaseId },
    query: { folder_id: folderId },
    body: {
      filename: file.name,
      contentType,
      size: file.size,
    },
    throwOnError: true,
  });

  try {
    const response = await fetch(upload.uploadUrl, {
      method: "PUT",
      headers: upload.uploadHeaders,
      body: file,
    });

    if (!response.ok) {
      throw new Error(`对象存储上传失败（${response.status}）`);
    }
  } catch (error) {
    const { error: cleanupError } = await knowledgeDocumentsDeleteDocument({
      path: { document_id: upload.id },
      throwOnError: false,
    });

    const reason = error instanceof Error ? error.message : "文件传输失败";

    if (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        `上传失败：${reason}。清理请求也失败：${getApiErrorMessage(cleanupError, "请求未完成")}。请刷新目录检查并删除残留记录后再上传。`,
      );
    }

    throw new Error(
      `上传失败：${reason}。文档记录已清理，可重新选择文件上传。`,
      {
        cause: error,
      },
    );
  }

  const { error: confirmationError } =
    await knowledgeDocumentsCompleteDocumentUpload({
      path: { document_id: upload.id },
      throwOnError: false,
    });

  if (confirmationError) {
    throw new Error(
      `确认上传失败：${getApiErrorMessage(confirmationError, "请求未完成")}。请先刷新目录检查状态；若仍显示“等待确认上传”，请使用“确认上传”，避免重复上传。`,
      { cause: confirmationError },
    );
  }
}
