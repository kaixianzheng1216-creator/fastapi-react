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
  FieldError,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  type KnowledgeFolderPublic,
  knowledgeBasesCreateFolder,
  knowledgeBasesUpdateFolder,
} from "@/lib/client";

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
  onSaved: () => Promise<void>;
  onClose: () => void;
  onCloseAutoFocus: (event: Event) => void;
}) {
  const [folderName, setFolderName] = useState(folder?.name ?? "");

  const saveFolder = useMutation({
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
    onSuccess: onSaved,
  });

  function submitFolder(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (saveFolder.isPending || !folderName.trim()) return;

    saveFolder.mutate(folderName.trim());
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saveFolder.isPending) onClose();
      }}
    >
      <DialogContent
        showCloseButton={!saveFolder.isPending}
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
            <Field
              data-invalid={saveFolder.isError}
              data-disabled={saveFolder.isPending}
            >
              <FieldLabel htmlFor="knowledge-folder-name">名称</FieldLabel>
              <Input
                id="knowledge-folder-name"
                name="name"
                value={folderName}
                maxLength={100}
                required
                autoComplete="off"
                autoFocus
                disabled={saveFolder.isPending}
                aria-invalid={saveFolder.isError}
                aria-describedby={
                  saveFolder.isError ? "knowledge-folder-name-error" : undefined
                }
                onChange={(event) => {
                  if (saveFolder.error) {
                    saveFolder.reset();
                  }

                  setFolderName(event.currentTarget.value);
                }}
              />
              {saveFolder.error ? (
                <FieldError id="knowledge-folder-name-error">
                  {getApiErrorMessage(
                    saveFolder.error,
                    saveFolder.error instanceof Error
                      ? saveFolder.error.message
                      : "保存文件夹失败",
                  )}
                </FieldError>
              ) : null}
            </Field>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={saveFolder.isPending}
                onClick={onClose}
              >
                取消
              </Button>
              <Button
                type="submit"
                disabled={saveFolder.isPending || !folderName.trim()}
              >
                {saveFolder.isPending ? (
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
