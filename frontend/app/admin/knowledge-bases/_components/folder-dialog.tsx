"use client";

import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  type KnowledgeFolderPublic,
  knowledgeBasesCreateFolder,
  knowledgeBasesUpdateFolder,
} from "@/lib/client";
import { toast } from "sonner";

export function KnowledgeFolderEditorDialog({
  knowledgeBaseId,
  parentFolderId,
  folder,
  onSaved,
  onClose,
  onCloseAutoFocus,
}: {
  knowledgeBaseId: string;
  parentFolderId?: string;
  folder?: KnowledgeFolderPublic;
  onSaved: () => void;
  onClose: () => void;
  onCloseAutoFocus: (event: Event) => void;
}) {
  const [folderName, setFolderName] = useState(folder?.name ?? "");

  const saveFolderMutation = useMutation({
    mutationFn: async (name: string): Promise<void> => {
      if (folder) {
        await knowledgeBasesUpdateFolder({
          path: {
            knowledge_base_id: knowledgeBaseId,
            folder_id: folder.id,
          },
          body: { name },
          throwOnError: true,
        });

        return;
      }

      await knowledgeBasesCreateFolder({
        path: { knowledge_base_id: knowledgeBaseId },
        body: { name, parent_id: parentFolderId ?? null },
        throwOnError: true,
      });
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
          <DialogDescription>
            文件夹用于整理当前知识库中的文档。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submitFolder}>
          <FieldGroup>
            <Field data-disabled={saveFolderMutation.isPending}>
              <FieldLabel htmlFor="knowledge-folder-name">名称</FieldLabel>
              <Input
                id="knowledge-folder-name"
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
                disabled={saveFolderMutation.isPending || !folderName.trim()}
              >
                {saveFolderMutation.isPending ? (
                  <Spinner data-icon="inline-start" />
                ) : null}
                保存
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
