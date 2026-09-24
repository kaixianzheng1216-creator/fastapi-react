"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  projectsCreateProject,
  projectsUpdateProject,
  type ProjectPublic,
} from "@/lib/client";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  FieldGroup,
  Field,
  FieldLabel,
  FieldError,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormDialogFooter } from "@/components/common/form-dialog-footer";
import {
  UserSelection,
  type SelectedUser,
} from "@/app/admin/_components/user-selection";

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "请输入项目名称")
    .max(100, "名称最多 100 个字符"),
  description: z.string().trim().max(500, "描述最多 500 个字符"),
});

export function ProjectDialog({
  project,
  onClose,
  onCloseAutoFocus,
  onSaved,
}: {
  project?: ProjectPublic;
  onClose: () => void;
  onCloseAutoFocus?: (event: Event) => void;
  onSaved: () => void;
}) {
  const [admins, setAdmins] = useState<SelectedUser[]>([]);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: project?.name ?? "",
      description: project?.description ?? "",
    },
  });

  const save = useMutation({
    mutationFn: async (value: z.infer<typeof schema>) => {
      const body = { name: value.name, description: value.description || null };
      if (project)
        await projectsUpdateProject({
          path: { project_id: project.id },
          body,
          throwOnError: true,
        });
      else
        await projectsCreateProject({
          body: { ...body, admin_ids: admins.map((u) => u.user_id) },
          throwOnError: true,
        });
    },
    onSuccess: () => {
      toast.success(project ? "项目已更新" : "项目已创建");
      onSaved();
      onClose();
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "项目保存失败")),
  });

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !save.isPending) onClose();
      }}
    >
      <DialogContent
        onCloseAutoFocus={onCloseAutoFocus}
        showCloseButton={!save.isPending}
      >
        <DialogHeader>
          <DialogTitle>{project ? "编辑项目" : "创建项目"}</DialogTitle>
          <DialogDescription>项目内的知识库与其他项目独立。</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit((value) => save.mutate(value))}>
          <FieldGroup>
            <Field data-invalid={!!form.formState.errors.name}>
              <FieldLabel htmlFor="project-name">项目名称</FieldLabel>
              <Input
                id="project-name"
                aria-invalid={!!form.formState.errors.name}
                disabled={save.isPending}
                {...form.register("name")}
              />
              <FieldError errors={[form.formState.errors.name]} />
            </Field>

            <Field data-invalid={!!form.formState.errors.description}>
              <FieldLabel htmlFor="project-description">描述</FieldLabel>
              <Textarea
                id="project-description"
                aria-invalid={!!form.formState.errors.description}
                disabled={save.isPending}
                {...form.register("description")}
              />
              <FieldError errors={[form.formState.errors.description]} />
            </Field>

            {!project && (
              <Field>
                <FieldLabel>项目管理员（可选）</FieldLabel>
                <UserSelection
                  selected={admins}
                  onChange={setAdmins}
                  disabled={save.isPending}
                />
              </Field>
            )}

            <FormDialogFooter
              isPending={save.isPending}
              submitLabel={project ? "保存" : "创建项目"}
            />
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
