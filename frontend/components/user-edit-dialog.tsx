"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

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
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { getApiErrorMessage } from "@/lib/api-error";
import { type UserPublic, usersUpdateUser } from "@/lib/client";

const userSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "用户名至少 3 个字符")
    .max(255, "用户名最多 255 个字符"),
  fullName: z.string().trim().max(255, "姓名最多 255 个字符"),
  isActive: z.boolean(),
  isSuperuser: z.boolean(),
});

type UserValues = z.infer<typeof userSchema>;

type UserEditDialogProps = {
  user: UserPublic;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
};

export function UserEditDialog({
  user,
  onOpenChange,
  onUpdated,
}: UserEditDialogProps) {
  const form = useForm<UserValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      username: user.username,
      fullName: user.full_name ?? "",
      isActive: user.is_active ?? true,
      isSuperuser: user.is_superuser ?? false,
    },
  });

  const updateUser = useMutation({
    mutationFn: async (values: UserValues): Promise<void> => {
      await usersUpdateUser({
        path: { user_id: user.id },
        body: {
          username: values.username,
          full_name: values.fullName || null,
          is_active: values.isActive,
          is_superuser: values.isSuperuser,
        },
        throwOnError: true,
      });
    },
  });

  const requestError = updateUser.error
    ? getApiErrorMessage(updateUser.error, "更新用户失败")
    : "";

  function handleOpenChange(open: boolean): void {
    if (!open && updateUser.isPending) {
      return;
    }

    onOpenChange(open);
  }

  function submitUser(values: UserValues): void {
    updateUser.mutate(values, {
      onSuccess: () => {
        onOpenChange(false);
        onUpdated();
      },
    });
  }

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={!updateUser.isPending}>
        <DialogHeader>
          <DialogTitle>编辑用户</DialogTitle>
          <DialogDescription>更新账户资料和权限。</DialogDescription>
        </DialogHeader>

        <form noValidate onSubmit={form.handleSubmit(submitUser)}>
          <FieldGroup>
            <Field data-invalid={!!form.formState.errors.username}>
              <FieldLabel htmlFor="edit-user-username">用户名</FieldLabel>
              <Input
                id="edit-user-username"
                autoComplete="off"
                aria-invalid={!!form.formState.errors.username}
                {...form.register("username")}
              />
              <FieldError errors={[form.formState.errors.username]} />
            </Field>

            <Field data-invalid={!!form.formState.errors.fullName}>
              <FieldLabel htmlFor="edit-user-full-name">姓名</FieldLabel>
              <Input
                id="edit-user-full-name"
                autoComplete="off"
                aria-invalid={!!form.formState.errors.fullName}
                {...form.register("fullName")}
              />
              <FieldError errors={[form.formState.errors.fullName]} />
            </Field>

            <Controller
              name="isActive"
              control={form.control}
              render={({ field }) => (
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldLabel htmlFor="edit-user-active">
                      启用账户
                    </FieldLabel>
                    <FieldDescription>允许该用户登录系统。</FieldDescription>
                  </FieldContent>
                  <Switch
                    id="edit-user-active"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </Field>
              )}
            />

            <Controller
              name="isSuperuser"
              control={form.control}
              render={({ field }) => (
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldLabel htmlFor="edit-user-superuser">
                      管理员
                    </FieldLabel>
                    <FieldDescription>允许访问管理后台。</FieldDescription>
                  </FieldContent>
                  <Switch
                    id="edit-user-superuser"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </Field>
              )}
            />

            <FieldError>{requestError}</FieldError>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={updateUser.isPending}
                onClick={() => handleOpenChange(false)}
              >
                取消
              </Button>
              <Button type="submit" disabled={updateUser.isPending}>
                {updateUser.isPending && <Spinner data-icon="inline-start" />}
                保存
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
