"use client";

import { useMutation } from "@tanstack/react-query";
import { UploadIcon } from "lucide-react";
import { type FormEvent, useId, useState } from "react";

import { KNOWLEDGE_DOCUMENT_UPLOAD_KEY } from "@/app/admin/knowledge-bases/_lib/directory";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FileDropzone } from "@/components/common/file-dropzone";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { FormDialogFooter } from "@/components/common/form-dialog-footer";
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
  KNOWLEDGE_FILE_ACCEPT,
  MAX_FILE_SIZE,
} from "@/lib/file-types";
import {
  transferDocumentUpload,
  uploadFiles,
  type UploadResult,
} from "@/lib/upload-files";
import { toast } from "sonner";

export function KnowledgeDocumentImport({
  knowledgeBaseId,
  folderId,
  onDocumentsChanged,
  disabled = false,
}: {
  knowledgeBaseId: string;
  folderId?: string;
  onDocumentsChanged: () => void;
  disabled?: boolean;
}) {
  const webpageInputId = useId();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadFailures, setUploadFailures] = useState<UploadResult[]>([]);
  const [open, setOpen] = useState(false);

  const uploadDocumentMutation = useMutation({
    mutationKey: [...KNOWLEDGE_DOCUMENT_UPLOAD_KEY, knowledgeBaseId],
    mutationFn: (files: File[]) =>
      uploadFiles(files, async (file) => {
        const contentType = getFileContentType(file);
        if (!contentType || !KNOWLEDGE_CONTENT_TYPES.includes(contentType)) {
          return { file, error: "不支持该文件类型，请选择其他文件" };
        }
        return uploadKnowledgeDocument(
          knowledgeBaseId,
          folderId,
          file,
          contentType,
        );
      }),

    onSuccess: (results) => {
      const failures = results.filter((result) => result.error);

      setUploadFailures(failures);
      setSelectedFiles(failures.map((result) => result.file));

      if (failures.length) {
        toast.error(
          `文件上传成功 ${results.length - failures.length} 个，失败 ${failures.length} 个`,
          {
            description: "失败文件已保留，可直接重试",
          },
        );
      } else {
        setOpen(false);
        toast.success(`文件已上传 ${results.length} 个，正在处理`);
      }

      if (results.some((result) => !result.error)) {
        onDocumentsChanged();
      }
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
      setOpen(false);
      onDocumentsChanged();
    },

    onError: (error) => {
      toast.error(getApiErrorMessage(error, "网页添加失败，请重试"));
    },
  });

  function submitWebpage(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (createWebpageMutation.isPending) return;

    createWebpageMutation.mutate(webpageUrl.trim());
  }

  const isPending =
    uploadDocumentMutation.isPending || createWebpageMutation.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (isPending) return;
        setOpen(nextOpen);
        setSelectedFiles([]);
        setUploadFailures([]);
        setWebpageUrl("");
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" disabled={disabled}>
          <UploadIcon data-icon="inline-start" aria-hidden="true" />
          添加文档
        </Button>
      </DialogTrigger>
      <DialogContent showCloseButton={!isPending}>
        <DialogHeader>
          <DialogTitle>添加文档</DialogTitle>
          <DialogDescription className="sr-only">
            上传本地文件，或输入公开网页地址。
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="files">
          <TabsList>
            <TabsTrigger value="files" disabled={isPending}>
              上传文件
            </TabsTrigger>
            <TabsTrigger value="webpage" disabled={isPending}>
              添加网页
            </TabsTrigger>
          </TabsList>

          <TabsContent value="files">
            <form
              onSubmit={submitUpload}
              className="flex flex-col gap-4"
            >
              <FieldGroup>
                <Field>
                  <FileDropzone
                    files={selectedFiles}
                    failures={uploadFailures}
                    disabled={isPending}
                    accept={KNOWLEDGE_FILE_ACCEPT}
                    description={`图片、PDF、Office 等常见文档 · 单个最大 ${formatFileSize(MAX_FILE_SIZE)}。`}
                    onFilesChange={(files) => {
                      setUploadFailures([]);
                      setSelectedFiles(files);
                    }}
                  />
                </Field>
              </FieldGroup>
              <FormDialogFooter
                isPending={isPending}
                disabled={selectedFiles.length === 0}
                submitLabel="确认上传"
              />
            </form>
          </TabsContent>

          <TabsContent value="webpage">
            <form
              onSubmit={submitWebpage}
              className="flex flex-col gap-4"
            >
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor={webpageInputId}>网页地址</FieldLabel>
                  <Input
                    id={webpageInputId}
                    name="url"
                    type="url"
                    pattern={"\\s*[Hh][Tt][Tt][Pp][Ss]?://\\S+\\s*"}
                    title="请输入以 http:// 或 https:// 开头的有效网页地址"
                    inputMode="url"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="https://example.com/article"
                    value={webpageUrl}
                    disabled={isPending}
                    aria-describedby={`${webpageInputId}-hint`}
                    onChange={(event) =>
                      setWebpageUrl(event.currentTarget.value)
                    }
                    required
                  />
                  <FieldDescription id={`${webpageInputId}-hint`}>
                    请使用 http:// 或 https://
                    开头的公开网页地址。系统会抓取正文并创建文档，不支持需要登录的页面。
                  </FieldDescription>
                </Field>
              </FieldGroup>
              <FormDialogFooter
                isPending={isPending}
                submitLabel="确认添加"
              />
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
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

  return transferDocumentUpload(file, upload, {
    complete: () =>
      knowledgeDocumentsCompleteDocumentUpload({
        path: { document_id: upload.id },
        throwOnError: false,
      }),
    discard: () =>
      knowledgeDocumentsDeleteDocument({
        path: { document_id: upload.id },
        throwOnError: false,
      }),
  });
}
