"use client";

import { GalleryVerticalEnd } from "lucide-react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { ButtonLoading } from "@/components/common/button-loading";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { loginLoginAccessToken } from "@/lib/client";
import { getApiErrorMessage } from "@/lib/api-error";
import { saveAccessToken } from "@/lib/auth";
import { cn } from "@/lib/utils";

const loginSchema = z.object({
  username: z.string().trim().min(1, "请输入用户名"),
  password: z.string().min(1, "请输入密码"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const queryClient = useQueryClient();

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const loginMutation = useMutation({
    mutationFn: ({ username, password }: LoginFormValues) =>
      loginLoginAccessToken({
        body: { username, password },
        throwOnError: true,
      }),
    onSuccess: ({ data }) => {
      saveAccessToken(data.access_token);

      queryClient.clear();

      window.location.replace("/");
    },

    onError: (error) => {
      loginForm.setError("root", {
        message: getApiErrorMessage(error, "账号登录失败，请稍后重试"),
      });
    },
  });

  function submitLogin(values: LoginFormValues): void {
    loginMutation.mutate(values);
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <form noValidate onSubmit={loginForm.handleSubmit(submitLogin)}>
        <FieldGroup>
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex size-8 items-center justify-center rounded-md">
              <GalleryVerticalEnd className="size-6" />
            </div>
            <h1 className="text-xl font-bold">登录账号</h1>
            <FieldDescription>
              还没有账号？<Link href="/signup">立即注册</Link>
            </FieldDescription>
          </div>

          <Field data-invalid={!!loginForm.formState.errors.username}>
            <FieldLabel htmlFor="username">用户名</FieldLabel>
            <Input
              disabled={loginMutation.isPending}
              id="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              aria-invalid={!!loginForm.formState.errors.username}
              {...loginForm.register("username")}
            />
            <FieldError errors={[loginForm.formState.errors.username]} />
          </Field>

          <Field data-invalid={!!loginForm.formState.errors.password}>
            <FieldLabel htmlFor="password">密码</FieldLabel>
            <Input
              disabled={loginMutation.isPending}
              id="password"
              type="password"
              autoComplete="current-password"
              aria-invalid={!!loginForm.formState.errors.password}
              {...loginForm.register("password")}
            />
            <FieldError errors={[loginForm.formState.errors.password]} />
          </Field>

          <FieldError errors={[loginForm.formState.errors.root]} />

          <Field>
            <Button
              className="relative"
              disabled={loginMutation.isPending}
              aria-busy={loginMutation.isPending}
              type="submit"
            >
              <ButtonLoading loading={loginMutation.isPending}>
                登录
              </ButtonLoading>
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </div>
  );
}
