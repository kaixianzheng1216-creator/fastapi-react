"use client";

import { useMutation } from "@tanstack/react-query";
import { GlobeIcon, UploadIcon } from "lucide-react";
import { type FormEvent, useRef, useState } from "react";

import { KNOWLEDGE_DOCUMENT_UPLOAD_KEY } from "@/app/admin/knowledge-bases/_lib/directory";
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
  formatFileSize,
  getFileContentType,
  KNOWLEDGE_CONTENT_TYPES,
  MAX_FILE_SIZE,
} from "@/lib/file-types";
import { toast } from "sonner";

const UPLOAD_CONCURRENCY = 3;
const DOCUMENT_ACCEPT = KNOWLEDGE_CONTENT_TYPES.join(",");

type UploadResult = { file: File; error?: string; needsCheck?: boolean };

export function KnowledgeDocumentImport({
  knowledgeBaseId,
  folderId,
  onDocumentsChanged,
}: {
  knowledgeBaseId: string;
  folderId?: string;
  onDocumentsChanged: () => void;
}) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadDocumentMutation = useMutation({
    mutationKey: [...KNOWLEDGE_DOCUMENT_UPLOAD_KEY, knowledgeBaseId],
    mutationFn: async (files: File[]): Promise<UploadResult[]> => {
      const outcomes: UploadResult[] = [];
      for (let start = 0; start < files.length; start += UPLOAD_CONCURRENCY) {
        const batch = files.slice(start, start + UPLOAD_CONCURRENCY);
        const results = await Promise.all(
          batch.map(async (file): Promise<UploadResult> => {
            const contentType = getFileContentType(file);
            if (
              !contentType ||
              !KNOWLEDGE_CONTENT_TYPES.includes(contentType)
            ) {
              return { file, error: "不支持该文件类型，请选择其他文件" };
            }
            if (file.size > MAX_FILE_SIZE) {
              return {
                file,
                error: `超过 ${formatFileSize(MAX_FILE_SIZE)}，请缩小文件后重试`,
              };
            }
            try {
              return await uploadKnowledgeDocument(
                knowledgeBaseId,
                folderId,
                file,
                contentType,
              );
            } catch (error) {
              return {
                file,
                error: getApiErrorMessage(error, "文件上传失败"),
              };
            }
          }),
        );
        outcomes.push(...results);
      }
      return outcomes;
    },

    onSuccess: (results) => {
      setUploadResults((previous) => [
        ...previous.filter(
          (item) => !results.some((result) => result.file === item.file),
        ),
        ...results,
      ]);

      const failures = results.filter((result) => result.error);
      setSelectedFiles(
        failures
          .filter((result) => !result.needsCheck)
          .map((result) => result.file),
      );

      if (fileInputRef.current) fileInputRef.current.value = "";

      if (failures.length) {
        toast.error(
          `文件上传成功 ${results.length - failures.length} 个，失败 ${failures.length} 个`,
          {
            description: "请查看添加文档区域中的处理结果",
          },
        );
      } else {
        toast.success(`文件已上传 ${results.length} 个，正在处理`);
      }

      onDocumentsChanged();
    },

    onError: () => {
      toast.error("文件上传失败，请重试");
    },
  });

  function submitUpload(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (!uploadDocumentMutation.isPending && selectedFiles.length > 0) {
      uploadDocumentMutation.mutate(selectedFiles);
    }
  }

  const [webpageUrl, setWebpageUrl] = useState("");

  const createWebpageMutation = useMutation({
    mutationFn: (url: string) =>
      knowledgeBasesCreateWebpageDocument({
        path: { knowledge_base_id: knowledgeBaseId },
        query: { folder_id: folderId },
        body: { url },
        throwOnError: true,
      }),
    onSuccess: () => {
      toast.success("网页已添加，正在处理");
      setWebpageUrl("");
      onDocumentsChanged();
    },

    onError: (error) => {
      toast.error(getApiErrorMessage(error, "网页添加失败，请重试"));
    },
  });

  function submitWebpage(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (createWebpageMutation.isPending) return;

    createWebpageMutation.mutate(webpageUrl);
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
                    支持图片（PNG、JPEG、WebP）、PDF、Word、Excel、PowerPoint、HTML、
                    Markdown、TXT、CSV 和 JSON。单个文件最大{" "}
                    {formatFileSize(MAX_FILE_SIZE)}。
                  </FieldDescription>
                  <Input
                    ref={fileInputRef}
                    id="knowledge-document"
                    name="document"
                    type="file"
                    accept={DOCUMENT_ACCEPT}
                    disabled={uploadDocumentMutation.isPending}
                    multiple
                    onChange={(event) => {
                      setUploadResults([]);
                      setSelectedFiles(
                        Array.from(event.currentTarget.files ?? []),
                      );
                    }}
                  />
                  {selectedFiles.length > 0 && (
                    <FieldDescription>
                      待上传 {selectedFiles.length} 个文件：
                      {selectedFiles.map((file) => file.name).join("、")}
                    </FieldDescription>
                  )}
                </Field>
                <Button
                  type="submit"
                  className="self-end"
                  disabled={
                    uploadDocumentMutation.isPending || selectedFiles.length === 0
                  }
                >
                  {uploadDocumentMutation.isPending ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <UploadIcon data-icon="inline-start" aria-hidden="true" />
                  )}
                  {selectedFiles.length > 0
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
                    disabled={createWebpageMutation.isPending}
                    onChange={(event) =>
                      setWebpageUrl(event.currentTarget.value)
                    }
                    required
                  />
                </Field>
                <Button
                  type="submit"
                  className="self-end"
                  disabled={
                    createWebpageMutation.isPending || !webpageUrl.trim()
                  }
                >
                  {createWebpageMutation.isPending ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <GlobeIcon data-icon="inline-start" aria-hidden="true" />
                  )}
                  添加网页
                </Button>
              </FieldGroup>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
      {uploadResults.length > 0 && (
        <CardFooter className="block">
          <details open={uploadResults.some((result) => result.error)}>
            <summary className="cursor-pointer text-sm">
              本次成功 {uploadResults.filter((result) => !result.error).length}{" "}
              个， 失败 {uploadResults.filter((result) => result.error).length}{" "}
              个
            </summary>
            <ul className="mt-2 flex flex-col gap-2 text-sm">
              {uploadResults.map((result, index) => (
                <li
                  key={`${result.file.name}-${index}`}
                  className="break-words"
                >
                  {result.file.name}：{result.error ?? "已上传，等待处理"}
                </li>
              ))}
            </ul>
          </details>
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
): Promise<UploadResult> {
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

    const reason = getApiErrorMessage(error, "文件传输失败");

    return {
      file,
      needsCheck: Boolean(cleanupError),
      error: cleanupError
        ? `上传失败：${reason}。清理请求也失败：${getApiErrorMessage(cleanupError, "请求未完成")}。请刷新目录检查并删除残留记录后再上传。`
        : `上传失败：${reason}。文档记录已清理，可重新上传。`,
    };
  }

  const { error: confirmationError } = await knowledgeDocumentsCompleteDocumentUpload({
    path: { document_id: upload.id },
    throwOnError: false,
  });

  if (confirmationError) {
    return {
      file,
      needsCheck: true,
      error: `确认上传失败：${getApiErrorMessage(confirmationError, "请求未完成")}。请先刷新目录检查状态；若仍显示“等待确认上传”，请使用“确认上传”，避免重复上传。`,
    };
  }

  return { file };
}
