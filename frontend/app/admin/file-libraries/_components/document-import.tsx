"use client";

import { useMutation } from "@tanstack/react-query";
import { UploadIcon } from "lucide-react";
import { type FormEvent, useRef, useState } from "react";

import { LIBRARY_DOCUMENT_UPLOAD_KEY } from "@/app/admin/file-libraries/_lib/directory";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  fileLibrariesCreateDocumentUpload,
  libraryDocumentsCompleteDocumentUpload,
  libraryDocumentsDeleteDocument,
} from "@/lib/client";
import {
  formatFileSize,
  getFileContentType,
  MAX_FILE_SIZE,
} from "@/lib/file-types";
import { toast } from "sonner";

const UPLOAD_CONCURRENCY = 3;

type UploadResult = { file: File; error?: string };

export function LibraryDocumentImport({
  fileLibraryId,
  folderId,
  onDocumentsChanged,
}: {
  fileLibraryId: string;
  folderId?: string;
  onDocumentsChanged: () => void;
}) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadFailures, setUploadFailures] = useState<UploadResult[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadDocumentMutation = useMutation({
    mutationKey: [...LIBRARY_DOCUMENT_UPLOAD_KEY, fileLibraryId],
    mutationFn: async (files: File[]): Promise<UploadResult[]> => {
      const outcomes: UploadResult[] = [];
      for (let start = 0; start < files.length; start += UPLOAD_CONCURRENCY) {
        const batch = files.slice(start, start + UPLOAD_CONCURRENCY);
        const results = await Promise.all(
          batch.map(async (file): Promise<UploadResult> => {
            const contentType =
              getFileContentType(file) || "application/octet-stream";
            if (file.size === 0 || file.size > MAX_FILE_SIZE) {
              return {
                file,
                error: `文件大小须大于 0 且不超过 ${formatFileSize(MAX_FILE_SIZE)}`,
              };
            }
            try {
              return await uploadLibraryDocument(
                fileLibraryId,
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
      const failures = results.filter((result) => result.error);

      setUploadFailures(failures);
      setSelectedFiles(failures.map((result) => result.file));

      if (fileInputRef.current) fileInputRef.current.value = "";

      if (failures.length) {
        toast.error(
          `文件上传成功 ${results.length - failures.length} 个，失败 ${failures.length} 个`,
          {
            description: "失败文件已保留，可直接重试",
          },
        );
      } else {
        toast.success(`文件已上传 ${results.length} 个`);
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>添加文件</CardTitle>
        <CardDescription>上传并保存原文件。</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submitUpload}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="library-document">文件</FieldLabel>
              <FieldDescription>
                支持任意文件类型，单个文件最大 {formatFileSize(MAX_FILE_SIZE)}。
              </FieldDescription>
              <Input
                ref={fileInputRef}
                id="library-document"
                name="document"
                type="file"
                disabled={uploadDocumentMutation.isPending}
                multiple
                onChange={(event) => {
                  setUploadFailures([]);
                  setSelectedFiles(Array.from(event.currentTarget.files ?? []));
                }}
              />
              {selectedFiles.length > 0 && (
                <FieldDescription>
                  待上传 {selectedFiles.length} 个文件：
                  {selectedFiles.map((file) => file.name).join("、")}
                </FieldDescription>
              )}
              <FieldError
                errors={uploadFailures.map((result) => ({
                  message: `${result.file.name}：${result.error}`,
                }))}
              />
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
      </CardContent>
    </Card>
  );
}

async function uploadLibraryDocument(
  fileLibraryId: string,
  folderId: string | undefined,
  file: File,
  contentType: string,
): Promise<UploadResult> {
  const { data: upload } = await fileLibrariesCreateDocumentUpload({
    path: { file_library_id: fileLibraryId },
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
    await libraryDocumentsDeleteDocument({
      path: { document_id: upload.id },
      throwOnError: false,
    });

    const reason = getApiErrorMessage(error, "文件传输失败");

    return {
      file,
      error: `上传失败：${reason}`,
    };
  }

  const { error: confirmationError } =
    await libraryDocumentsCompleteDocumentUpload({
      path: { document_id: upload.id },
      throwOnError: false,
    });

  if (confirmationError) {
    return {
      file,
      error: getApiErrorMessage(confirmationError, "确认上传失败"),
    };
  }

  return { file };
}
