"use client";

import { useMutation } from "@tanstack/react-query";
import { UploadIcon } from "lucide-react";
import { type FormEvent, useState } from "react";

import { LIBRARY_DOCUMENT_UPLOAD_KEY } from "@/app/admin/(platform)/file-libraries/_lib/directory";
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
import { Field, FieldGroup } from "@/components/ui/field";
import { FormDialogFooter } from "@/components/common/form-dialog-footer";
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
import {
  transferDocumentUpload,
  uploadFiles,
  type UploadResult,
} from "@/lib/upload-files";
import { toast } from "sonner";

export function LibraryDocumentImport({
  fileLibraryId,
  folderId,
  onDocumentsChanged,
  disabled = false,
}: {
  fileLibraryId: string;
  folderId?: string;
  onDocumentsChanged: () => void;
  disabled?: boolean;
}) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadFailures, setUploadFailures] = useState<UploadResult[]>([]);
  const [open, setOpen] = useState(false);

  const uploadDocumentMutation = useMutation({
    mutationKey: [...LIBRARY_DOCUMENT_UPLOAD_KEY, fileLibraryId],
    mutationFn: (files: File[]) =>
      uploadFiles(files, (file) =>
        uploadLibraryDocument(
          fileLibraryId,
          folderId,
          file,
          getFileContentType(file) || "application/octet-stream",
        ),
      ),

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

  const isPending = uploadDocumentMutation.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (isPending) return;
        setOpen(nextOpen);
        setSelectedFiles([]);
        setUploadFailures([]);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" disabled={disabled}>
          <UploadIcon data-icon="inline-start" aria-hidden="true" />
          上传文件
        </Button>
      </DialogTrigger>
      <DialogContent showCloseButton={!isPending}>
        <DialogHeader>
          <DialogTitle>上传文件</DialogTitle>
          <DialogDescription className="sr-only">
            上传并保存原文件。支持批量选择或拖拽上传。
          </DialogDescription>
        </DialogHeader>
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
                description={`支持任意文件类型，单个文件最大 ${formatFileSize(MAX_FILE_SIZE)}。`}
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
      </DialogContent>
    </Dialog>
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

  return transferDocumentUpload(file, upload, {
    complete: () =>
      libraryDocumentsCompleteDocumentUpload({
        path: { document_id: upload.id },
        throwOnError: false,
      }),
    discard: () =>
      libraryDocumentsDeleteDocument({
        path: { document_id: upload.id },
        throwOnError: false,
      }),
  });
}
