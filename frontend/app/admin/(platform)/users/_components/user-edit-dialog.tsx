"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { FormDialogFooter } from "@/components/common/form-dialog-footer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { getApiErrorMessage } from "@/lib/api-error";
import { type UserPublic, usersUpdateUser } from "@/lib/client";
import { toast } from "sonner";

const userSchema = z.object({
  isSuperuser: z.boolean(),
});

type UserValues = z.infer<typeof userSchema>;

type UserEditDialogProps = {
  user: UserPublic;
  canChangeRole: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus?: (event: Event) => void;
  onUpdated: () => void;
};

export function UserEditDialog({
  user,
  canChangeRole,
  onOpenChange,
  onCloseAutoFocus,
  onUpdated,
}: UserEditDialogProps) {
  const form = useForm<UserValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      isSuperuser: user.is_superuser ?? false,
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async (values: UserValues): Promise<void> => {
      await usersUpdateUser({
        path: { user_id: user.id },
        body: {
          is_superuser: values.isSuperuser,
        },
        throwOnError: true,
      });
    },

    onSuccess: () => {
      toast.success("用户已更新");
      onOpenChange(false);
      onUpdated();
    },

    onError: (error) => {
      toast.error(getApiErrorMessage(error, "用户更新失败，请重试"));
    },
  });

  function handleOpenChange(open: boolean): void {
    if (!open && updateUserMutation.isPending) {
      return;
    }

    onOpenChange(open);
  }

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent
        onCloseAutoFocus={onCloseAutoFocus}
        showCloseButton={!updateUserMutation.isPending}
      >
        <DialogHeader>
          <DialogTitle>编辑用户</DialogTitle>
          <DialogDescription>管理用户的平台权限。</DialogDescription>
        </DialogHeader>

        <form
          noValidate
          onSubmit={form.handleSubmit((values) =>
            updateUserMutation.mutate(values),
          )}
        >
          <FieldGroup>
            <Field>
              <FieldLabel>姓名</FieldLabel>
              <Input value={user.full_name ?? user.username} readOnly />
              <FieldDescription>姓名由统一登录服务同步。</FieldDescription>
            </Field>

            <Controller
              name="isSuperuser"
              control={form.control}
              render={({ field }) => (
                <Field
                  orientation="horizontal"
                  data-disabled={!canChangeRole || updateUserMutation.isPending}
                >
                  <FieldContent>
                    <FieldLabel htmlFor="edit-user-superuser">
                      管理员
                    </FieldLabel>
                    <FieldDescription>
                      {canChangeRole
                        ? "管理所有项目和平台账号。"
                        : "不能取消自己的管理员身份。"}
                    </FieldDescription>
                  </FieldContent>
                  <Switch
                    id="edit-user-superuser"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={!canChangeRole || updateUserMutation.isPending}
                  />
                </Field>
              )}
            />

            <FormDialogFooter
              isPending={updateUserMutation.isPending}
              submitLabel="保存"
            />
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
