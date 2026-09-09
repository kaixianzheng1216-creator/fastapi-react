"use client";

import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { ButtonLoading } from "@/components/common/button-loading";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  fileLibrariesCreateFolder,
  fileLibrariesUpdateFolder,
  knowledgeBasesCreateFolder,
  knowledgeBasesUpdateFolder,
} from "@/lib/client";
import { toast } from "sonner";

export function FolderEditorDialog({
  kind,
  libraryId,
  parentFolderId,
  folder,
  onSaved,
  onClose,
  onCloseAutoFocus,
}: {
  kind: "file" | "knowledge";
  libraryId: string;
  parentFolderId?: string;
  folder?: { id: string; name: string };
  onSaved: () => void;
  onClose: () => void;
  onCloseAutoFocus: (event: Event) => void;
}) {
  const [folderName, setFolderName] = useState(folder?.name ?? "");

  const saveFolderMutation = useMutation({
    mutationFn: async (name: string): Promise<void> => {
      if (kind === "file") {
        if (folder) {
          await fileLibrariesUpdateFolder({
            path: { file_library_id: libraryId, folder_id: folder.id },
            body: { name },
            throwOnError: true,
          });
        } else {
          await fileLibrariesCreateFolder({
            path: { file_library_id: libraryId },
            body: { name, parent_id: parentFolderId ?? null },
            throwOnError: true,
          });
        }
      } else if (folder) {
        await knowledgeBasesUpdateFolder({
          path: { knowledge_base_id: libraryId, folder_id: folder.id },
          body: { name },
          throwOnError: true,
        });
      } else {
        await knowledgeBasesCreateFolder({
          path: { knowledge_base_id: libraryId },
          body: { name, parent_id: parentFolderId ?? null },
          throwOnError: true,
        });
      }
    },
    onSuccess: () => {
      toast.success(folder ? "文件夹已重命名" : "文件夹已创建");
      onSaved();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "文件夹保存失败，请重试"));
    },
  });

  function submitFolder(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (saveFolderMutation.isPending || !folderName.trim()) return;

    saveFolderMutation.mutate(folderName.trim());
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saveFolderMutation.isPending) onClose();
      }}
    >
      <DialogContent
        showCloseButton={!saveFolderMutation.isPending}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <DialogHeader>
          <DialogTitle>{folder ? "重命名文件夹" : "新建文件夹"}</DialogTitle>
          <DialogDescription>文件夹用于整理当前库中的文件。</DialogDescription>
        </DialogHeader>
        <form onSubmit={submitFolder}>
          <FieldGroup>
            <Field data-disabled={saveFolderMutation.isPending}>
              <FieldLabel htmlFor="library-folder-name">名称</FieldLabel>
              <Input
                id="library-folder-name"
                name="name"
                value={folderName}
                maxLength={100}
                required
                autoComplete="off"
                autoFocus
                disabled={saveFolderMutation.isPending}
                onChange={(event) => setFolderName(event.currentTarget.value)}
              />
            </Field>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={saveFolderMutation.isPending}
                onClick={onClose}
              >
                取消
              </Button>
              <Button
                type="submit"
                className="relative"
                disabled={saveFolderMutation.isPending || !folderName.trim()}
                aria-busy={saveFolderMutation.isPending}
              >
                <ButtonLoading loading={saveFolderMutation.isPending}>
                  {folder ? "保存" : "创建文件夹"}
                </ButtonLoading>
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
