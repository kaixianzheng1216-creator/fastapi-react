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
import { usersCreateUser } from "@/lib/client";

const userSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "用户名至少 3 个字符")
    .max(255, "用户名最多 255 个字符"),
  fullName: z.string().trim().max(255, "姓名最多 255 个字符"),
  password: z
    .string()
    .min(8, "密码至少 8 个字符")
    .max(128, "密码最多 128 个字符"),
  isActive: z.boolean(),
  isSuperuser: z.boolean(),
});

type UserValues = z.infer<typeof userSchema>;

type UserCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
};

export function UserCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: UserCreateDialogProps) {
  const form = useForm<UserValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      username: "",
      fullName: "",
      password: "",
      isActive: true,
      isSuperuser: false,
    },
  });

  const createUser = useMutation({
    mutationFn: async (values: UserValues): Promise<void> => {
      await usersCreateUser({
        body: {
          username: values.username,
          full_name: values.fullName || null,
          password: values.password,
          is_active: values.isActive,
          is_superuser: values.isSuperuser,
        },
        throwOnError: true,
      });
    },
  });

  const requestError = createUser.error
    ? getApiErrorMessage(createUser.error, "创建用户失败")
    : "";

  function handleOpenChange(nextOpen: boolean): void {
    if (!nextOpen && createUser.isPending) {
      return;
    }

    if (!nextOpen) {
      createUser.reset();
      form.reset();
    }

    onOpenChange(nextOpen);
  }

  function submitUser(values: UserValues): void {
    createUser.mutate(values, {
      onSuccess: () => {
        form.reset();
        onOpenChange(false);
        onCreated();
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={!createUser.isPending}>
        <DialogHeader>
          <DialogTitle>创建用户</DialogTitle>
          <DialogDescription>创建可以登录系统的新账户。</DialogDescription>
        </DialogHeader>

        <form noValidate onSubmit={form.handleSubmit(submitUser)}>
          <FieldGroup>
            <Field data-invalid={!!form.formState.errors.username}>
              <FieldLabel htmlFor="new-user-username">用户名</FieldLabel>
              <Input
                id="new-user-username"
                autoComplete="off"
                aria-invalid={!!form.formState.errors.username}
                {...form.register("username")}
              />
              <FieldError errors={[form.formState.errors.username]} />
            </Field>

            <Field data-invalid={!!form.formState.errors.fullName}>
              <FieldLabel htmlFor="new-user-full-name">姓名</FieldLabel>
              <Input
                id="new-user-full-name"
                autoComplete="off"
                aria-invalid={!!form.formState.errors.fullName}
                {...form.register("fullName")}
              />
              <FieldError errors={[form.formState.errors.fullName]} />
            </Field>

            <Field data-invalid={!!form.formState.errors.password}>
              <FieldLabel htmlFor="new-user-password">密码</FieldLabel>
              <Input
                id="new-user-password"
                type="password"
                autoComplete="new-password"
                aria-invalid={!!form.formState.errors.password}
                {...form.register("password")}
              />
              <FieldError errors={[form.formState.errors.password]} />
            </Field>

            <Controller
              name="isActive"
              control={form.control}
              render={({ field }) => (
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldLabel htmlFor="new-user-active">启用账户</FieldLabel>
                    <FieldDescription>允许该用户登录系统。</FieldDescription>
                  </FieldContent>
                  <Switch
                    id="new-user-active"
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
                    <FieldLabel htmlFor="new-user-superuser">
                      管理员
                    </FieldLabel>
                    <FieldDescription>允许访问管理后台。</FieldDescription>
                  </FieldContent>
                  <Switch
                    id="new-user-superuser"
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
                disabled={createUser.isPending}
                onClick={() => handleOpenChange(false)}
              >
                取消
              </Button>
              <Button type="submit" disabled={createUser.isPending}>
                {createUser.isPending && <Spinner data-icon="inline-start" />}
                创建用户
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
