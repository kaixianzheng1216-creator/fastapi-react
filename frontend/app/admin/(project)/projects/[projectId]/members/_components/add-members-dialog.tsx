"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  UserSelection,
  type SelectedUser,
} from "@/app/admin/_components/user-selection";
import { FormDialogFooter } from "@/components/common/form-dialog-footer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { getApiErrorMessage } from "@/lib/api-error";
import { projectsAddMembers, type ProjectPublic } from "@/lib/client";

export function AddMembersDialog({
  project,
  onAdded,
  onClose,
  onCloseAutoFocus,
}: {
  project: Pick<ProjectPublic, "id" | "name">;
  onAdded: () => void;
  onClose: () => void;
  onCloseAutoFocus: (event: Event) => void;
}) {
  const [selected, setSelected] = useState<SelectedUser[]>([]);
  const add = useMutation({
    mutationFn: (userIds: string[]) =>
      projectsAddMembers({
        path: { project_id: project.id },
        body: { user_ids: userIds },
        throwOnError: true,
      }),
    onSuccess: () => {
      onAdded();
      onClose();
      toast.success("成员已添加");
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "添加失败")),
  });

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !add.isPending) onClose();
      }}
    >
      <DialogContent
        onCloseAutoFocus={onCloseAutoFocus}
        showCloseButton={!add.isPending}
      >
        <DialogHeader>
          <DialogTitle>添加成员到 {project.name}</DialogTitle>
          <DialogDescription>
            选择已有账号，加入后可以维护本项目知识库和密钥。
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (selected.length && !add.isPending) {
              add.mutate(selected.map((user) => user.user_id));
            }
          }}
        >
          <FieldGroup>
            <UserSelection
              projectId={project.id}
              selected={selected}
              onChange={setSelected}
              disabled={add.isPending}
            />
            <FormDialogFooter
              isPending={add.isPending}
              disabled={!selected.length}
              submitLabel="添加成员"
            />
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
