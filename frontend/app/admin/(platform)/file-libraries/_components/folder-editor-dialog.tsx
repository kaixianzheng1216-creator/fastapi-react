"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { NameDialog } from "@/components/common/name-dialog";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  fileLibrariesCreateFolder,
  fileLibrariesUpdateFolder,
} from "@/lib/client";

export function FolderEditorDialog({
  libraryId,
  parentFolderId,
  folder,
  onSaved,
  onClose,
  onCloseAutoFocus,
}: {
  libraryId: string;
  parentFolderId?: string;
  folder?: { id: string; name: string };
  onSaved: () => void;
  onClose: () => void;
  onCloseAutoFocus: (event: Event) => void;
}) {
  const save = useMutation({
    mutationFn: async (name: string) => {
      if (folder)
        await fileLibrariesUpdateFolder({
          path: { file_library_id: libraryId, folder_id: folder.id },
          body: { name },
          throwOnError: true,
        });
      else
        await fileLibrariesCreateFolder({
          path: { file_library_id: libraryId },
          body: { name, parent_id: parentFolderId ?? null },
          throwOnError: true,
        });
    },
    onSuccess: () => {
      toast.success(folder ? "文件夹已重命名" : "文件夹已创建");
      onSaved();
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "文件夹保存失败，请重试")),
  });

  return (
    <NameDialog
      title={folder ? "重命名文件夹" : "新建文件夹"}
      description="文件夹用于整理当前库中的文件。"
      initialName={folder?.name}
      submitLabel={folder ? "保存" : "创建文件夹"}
      isPending={save.isPending}
      onSubmit={save.mutate}
      onClose={onClose}
      onCloseAutoFocus={onCloseAutoFocus}
    />
  );
}
