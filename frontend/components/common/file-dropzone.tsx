"use client";

import { UploadIcon, XIcon } from "lucide-react";
import { useId } from "react";
import { toast } from "sonner";

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
  files,
  onFilesChange,
  accept,
  description,
  disabled = false,
  failures = [],
}: {
  files: File[];
  onFilesChange: (files: File[]) => void;
  accept?: string;
  description: string;
  disabled?: boolean;
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
      <FileUploadDropzone aria-describedby={descriptionId}>
        <div className="flex flex-col items-center gap-1 text-center">
          <div className="flex items-center justify-center rounded-full border p-2.5">
            <UploadIcon className="size-6 text-muted-foreground" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium">拖拽文件到此处</p>
          <p id={descriptionId} className="text-xs text-muted-foreground">
            {description}
          </p>
        </div>
        <FileUploadTrigger asChild>
          <Button variant="outline" size="sm" className="mt-2 w-fit">
            选择文件
          </Button>
        </FileUploadTrigger>
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
