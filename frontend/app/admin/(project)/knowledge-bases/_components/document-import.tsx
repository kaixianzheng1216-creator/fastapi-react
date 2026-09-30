"use client";

import { useMutation } from "@tanstack/react-query";
import {
  ArrowLeftIcon,
  LinkIcon,
  ClipboardIcon,
  UploadIcon,
} from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { toast } from "sonner";

import { DocumentSearch, type SearchSource } from "./document-search";

import { KNOWLEDGE_DOCUMENT_UPLOAD_KEY } from "../_lib/directory";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FileUploadTrigger } from "@/components/ui/file-upload";
import { FileDropzone } from "@/components/common/file-dropzone";
import { FormDialogFooter } from "@/components/common/form-dialog-footer";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

import { cn } from "@/lib/utils";
import { getApiErrorMessage } from "@/lib/api-error";
import { mapConcurrent } from "@/lib/map-concurrent";
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

type ImportView = "files" | "webpage" | "text" | "search";

const viewTitles: Record<ImportView, string> = {
  files: "添加文档",
  webpage: "网站链接",
  text: "粘贴文字",
  search: "搜索来源",
};

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
  const inputId = useId();

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<ImportView>("files");

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [text, setText] = useState("");
  const [urlError, setUrlError] = useState("");

  function finishImport(failures: { error?: string }[], total: number) {
    if (failures.length < total) onDocumentsChanged();

    if (failures.length) {
      toast.error("文档添加失败，请重试", {
        description: failures[0].error,
      });
    } else {
      toast.success("文档已添加，正在处理");
      setOpen(false);
    }
  }

  const uploadMutation = useMutation({
    mutationKey: [...KNOWLEDGE_DOCUMENT_UPLOAD_KEY, knowledgeBaseId],

    mutationFn: async (files: File[]) => {
      const results = await uploadFiles(files, (file) =>
        uploadKnowledgeDocument(knowledgeBaseId, folderId, file),
      );

      return results.filter((result) => result.error);
    },

    onSuccess: (failures, files) => {
      if (view === "files") {
        setSelectedFiles(failures.map((result) => result.file));
      }

      finishImport(failures, files.length);
    },
  });

  const importUrlsMutation = useMutation({
    mutationFn: async ({
      urls,
      source,
    }: {
      urls: string[];
      source: SearchSource;
    }) => {
      const results = await mapConcurrent(urls, async (url) => {
        try {
          await knowledgeBasesCreateWebpageDocument({
            path: { knowledge_base_id: knowledgeBaseId },
            query: { folder_id: folderId },
            body: { url, source },
            throwOnError: true,
          });
        } catch (error) {
          return {
            url,
            error: getApiErrorMessage(error, "内容添加失败，请重试"),
          };
        }
      });

      return results.filter((result) => result !== undefined);
    },

    onSuccess: (failures, { urls }) => {
      if (view === "webpage") {
        setUrlInput(failures.map(({ url }) => url).join("\n"));
      }

      finishImport(failures, urls.length);
    },
  });

  const isPending = uploadMutation.isPending || importUrlsMutation.isPending;
  const uploadFailures = uploadMutation.data ?? [];
  const textError = uploadFailures[0]?.error;

  function submitUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    uploadMutation.mutate(selectedFiles);
  }

  function submitText(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const documentName = text
      .trim()
      .split(/\r?\n/, 1)[0]
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
      .slice(0, 80);

    uploadMutation.mutate([
      new File([text], `${documentName}.txt`, { type: "text/plain" }),
    ]);
  }

  function submitWebpages(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const urls: string[] = [];
    const lines = urlInput.split(/\r?\n/);

    for (const [index, line] of lines.entries()) {
      const address = line.trim();

      if (!address) continue;

      try {
        const url = new URL(address);

        if (!["http:", "https:"].includes(url.protocol)) throw new Error();

        urls.push(url.href);
      } catch {
        setUrlError(`第 ${index + 1} 行不是有效的 http:// 或 https:// 网址`);

        return;
      }
    }

    importUrlsMutation.mutate({
      urls: [...new Set(urls)],
      source: "web",
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (isPending) return;

        setOpen(nextOpen);
        setView("files");

        setSelectedFiles([]);
        uploadMutation.reset();

        setUrlInput("");
        setText("");
        setUrlError("");
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" disabled={disabled}>
          <UploadIcon data-icon="inline-start" aria-hidden="true" />
          添加文档
        </Button>
      </DialogTrigger>

      <DialogContent
        showCloseButton={!isPending}
        className={cn(
          "max-h-[90svh] sm:max-w-[min(40rem,calc(100%-2rem))]",
          view === "search" && "flex flex-col overflow-hidden",
        )}
      >
        <DialogHeader className="shrink-0">
          <div className="flex items-center gap-2">
            {view !== "files" && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="返回添加文档"
                disabled={isPending}
                onClick={() => setView("files")}
              >
                <ArrowLeftIcon aria-hidden="true" />
              </Button>
            )}

            <DialogTitle>{viewTitles[view]}</DialogTitle>
          </div>

          <DialogDescription className="sr-only">
            搜索网络资料、上传文件、添加网页或粘贴文字。
          </DialogDescription>
        </DialogHeader>

        {open && (
          <DocumentSearch
            knowledgeBaseId={knowledgeBaseId}
            mode={
              view === "search"
                ? "results"
                : view === "files"
                  ? "input"
                  : "hidden"
            }
            importing={isPending}
            onSearch={() => setView("search")}
            onImport={(urls, source) =>
              importUrlsMutation.mutateAsync({ urls, source })
            }
          />
        )}

        {view === "files" && (
          <form onSubmit={submitUpload} className="flex flex-col gap-4">
            <FieldGroup>
              <Field>
                <FileDropzone
                  showSelectButton={false}
                  files={selectedFiles}
                  failures={uploadFailures}
                  disabled={isPending}
                  accept={KNOWLEDGE_FILE_ACCEPT}
                  description={`支持文档（PDF、DOCX、XLSX、PPTX、TXT、MD、CSV、HTML）、图片（JPG/JPEG、PNG、WebP）、音频（MP3、WAV、M4A）和视频（MP4、MOV）。单个文件最大 ${formatFileSize(MAX_FILE_SIZE)}。`}
                  onFilesChange={(files) => {
                    uploadMutation.reset();
                    setSelectedFiles(files);
                  }}
                >
                  <div className="flex flex-wrap gap-2">
                    <FileUploadTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                      >
                        <UploadIcon
                          data-icon="inline-start"
                          aria-hidden="true"
                        />
                        上传文件
                      </Button>
                    </FileUploadTrigger>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      onClick={() => setView("webpage")}
                    >
                      <LinkIcon data-icon="inline-start" aria-hidden="true" />
                      网站链接
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      onClick={() => {
                        uploadMutation.reset();
                        setView("text");
                      }}
                    >
                      <ClipboardIcon
                        data-icon="inline-start"
                        aria-hidden="true"
                      />
                      粘贴文字
                    </Button>
                  </div>
                </FileDropzone>
              </Field>
            </FieldGroup>

            <FormDialogFooter
              isPending={isPending}
              disabled={selectedFiles.length === 0}
              submitLabel="确认上传"
            />
          </form>
        )}

        {view === "webpage" && (
          <form onSubmit={submitWebpages} className="flex flex-col gap-4">
            <FieldGroup>
              <Field data-invalid={!!urlError}>
                <FieldLabel htmlFor={`${inputId}-url`}>网页地址</FieldLabel>

                <Textarea
                  id={`${inputId}-url`}
                  className="min-h-40"
                  placeholder="粘贴网址，每行一个……"
                  value={urlInput}
                  disabled={isPending}
                  aria-invalid={!!urlError}
                  aria-describedby={`${inputId}-url-hint`}
                  onChange={(event) => {
                    setUrlInput(event.target.value);
                    setUrlError("");
                  }}
                  required
                />

                <FieldDescription id={`${inputId}-url-hint`}>
                  仅支持以 http:// 或 https:// 开头的公开网页。
                </FieldDescription>

                <FieldError>{urlError}</FieldError>
              </Field>
            </FieldGroup>

            <FormDialogFooter
              isPending={isPending}
              disabled={!urlInput.trim()}
              submitLabel="确认添加"
            />
          </form>
        )}

        {view === "text" && (
          <form onSubmit={submitText} className="flex flex-col gap-4">
            <FieldGroup>
              <Field data-invalid={!!textError}>
                <FieldLabel htmlFor={`${inputId}-text`}>正文</FieldLabel>

                <Textarea
                  id={`${inputId}-text`}
                  className="min-h-48"
                  placeholder="在这里输入或粘贴文字……"
                  value={text}
                  disabled={isPending}
                  aria-invalid={!!textError}
                  aria-describedby={`${inputId}-text-hint`}
                  onChange={(event) => {
                    setText(event.target.value);
                    uploadMutation.reset();
                  }}
                  required
                />

                <FieldDescription id={`${inputId}-text-hint`}>
                  使用首行文字作为文档名称。
                </FieldDescription>

                <FieldError>{textError}</FieldError>
              </Field>
            </FieldGroup>

            <FormDialogFooter
              isPending={isPending}
              disabled={!text.trim()}
              submitLabel="确认添加"
            />
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

async function uploadKnowledgeDocument(
  knowledgeBaseId: string,
  folderId: string | undefined,
  file: File,
): Promise<UploadResult> {
  const contentType = getFileContentType(file);

  if (!contentType || !KNOWLEDGE_CONTENT_TYPES.includes(contentType)) {
    return { file, error: "不支持该文件类型，请选择其他文件" };
  }

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
