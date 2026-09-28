"use client";

import { UploadIcon, XIcon } from "lucide-react";
import { type ReactNode, useId } from "react";
import { toast } from "sonner";

import {
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { FieldDescription, FieldError } from "@/components/ui/field";
import {
  FileUpload,
  FileUploadClear,
  FileUploadDropzone,
  FileUploadItem,
  FileUploadItemDelete,
  FileUploadItemMetadata,
  FileUploadList,
  FileUploadTrigger,
} from "@/components/ui/file-upload";
import { deduplicateUploadFiles } from "@/lib/file-types";

export function FileDropzone({
  children,
  files,
  onFilesChange,
  accept,
  description,
  disabled = false,
  showSelectButton = true,
  failures = [],
}: {
  children?: ReactNode;
  files: File[];
  onFilesChange: (files: File[]) => void;
  accept?: string;
  description: string;
  disabled?: boolean;
  showSelectButton?: boolean;
  failures?: { file: File; error?: string }[];
}) {
  const descriptionId = useId();

  return (
    <FileUpload
      value={files}
      onValueChange={(nextFiles) =>
        onFilesChange(deduplicateUploadFiles(nextFiles))
      }
      accept={accept}
      disabled={disabled}
      label="选择上传文件"
      onFileReject={(file) =>
        toast.error("不支持该文件类型", { description: file.name })
      }
      multiple
    >
      {children}
      <FileUploadDropzone aria-describedby={descriptionId}>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <UploadIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>拖拽文件到此处</EmptyTitle>
          <EmptyDescription id={descriptionId}>{description}</EmptyDescription>
        </EmptyHeader>
        {showSelectButton && (
          <FileUploadTrigger asChild>
            <Button variant="outline" size="sm">
              选择文件
            </Button>
          </FileUploadTrigger>
        )}
      </FileUploadDropzone>
      <FileUploadList className="scroll-content-y max-h-[clamp(8rem,30svh,15rem)] overscroll-contain">
        {files.map((file) => (
          <FileUploadItem
            key={`${file.name}-${file.size}-${file.lastModified}`}
            value={file}
            className="shrink-0"
          >
            <div className="min-w-0 flex-1">
              <FileUploadItemMetadata title={file.name} />
              <FieldError>
                {failures.find((failure) => failure.file === file)?.error}
              </FieldError>
            </div>
            <FileUploadItemDelete asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={disabled}
                aria-label={`移除 ${file.name}`}
              >
                <XIcon aria-hidden="true" />
              </Button>
            </FileUploadItemDelete>
          </FileUploadItem>
        ))}
      </FileUploadList>
      {files.length > 0 && (
        <div className="flex items-center justify-between gap-2">
          <FieldDescription role="status">
            已选择 {files.length} 个文件
          </FieldDescription>
          <FileUploadClear asChild>
            <Button variant="ghost" size="sm">
              清空全部
            </Button>
          </FileUploadClear>
        </div>
      )}
    </FileUpload>
  );
}
