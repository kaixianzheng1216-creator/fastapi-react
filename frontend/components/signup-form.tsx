"use client";

import { GalleryVerticalEnd } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getApiErrorMessage } from "@/lib/api-error";
import { usersRegisterUser } from "@/lib/client";
import { cn } from "@/lib/utils";

const signupSchema = z.object({
  fullName: z.string().trim().max(255, "昵称最多 255 个字符"),
  username: z
    .string()
    .trim()
    .min(3, "用户名至少 3 个字符")
    .max(255, "用户名最多 255 个字符"),
  password: z
    .string()
    .min(8, "密码至少 8 个字符")
    .max(128, "密码最多 128 个字符"),
});

type SignupFormValues = z.infer<typeof signupSchema>;

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter();
  const signupForm = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
  });

  const signupMutation = useMutation({
    mutationFn: async ({
      fullName,
      username,
      password,
    }: SignupFormValues) => {
      await usersRegisterUser({
        body: {
          full_name: fullName || null,
          username,
          password,
        },
        throwOnError: true,
      });
    },
    onSuccess: () => router.replace("/login"),
  });
  const error = signupMutation.error
    ? getApiErrorMessage(signupMutation.error, "注册失败")
    : "";

  function submitSignup(values: SignupFormValues): void {
    signupMutation.mutate(values);
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <form noValidate onSubmit={signupForm.handleSubmit(submitSignup)}>
        <FieldGroup>
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex size-8 items-center justify-center rounded-md">
              <GalleryVerticalEnd className="size-6" />
            </div>
            <h1 className="text-xl font-bold">创建账号</h1>
            <FieldDescription>
              已有账号？<Link href="/login">返回登录</Link>
            </FieldDescription>
          </div>

          <Field data-invalid={!!signupForm.formState.errors.fullName}>
            <FieldLabel htmlFor="fullName">昵称（可选）</FieldLabel>
            <Input
              id="fullName"
              autoComplete="name"
              maxLength={255}
              aria-invalid={!!signupForm.formState.errors.fullName}
              {...signupForm.register("fullName")}
            />
            <FieldError errors={[signupForm.formState.errors.fullName]} />
          </Field>

          <Field data-invalid={!!signupForm.formState.errors.username}>
            <FieldLabel htmlFor="username">用户名</FieldLabel>
            <Input
              id="username"
              autoComplete="username"
              minLength={3}
              maxLength={255}
              aria-invalid={!!signupForm.formState.errors.username}
              {...signupForm.register("username")}
            />
            <FieldError errors={[signupForm.formState.errors.username]} />
          </Field>

          <Field data-invalid={!!signupForm.formState.errors.password}>
            <FieldLabel htmlFor="password">密码</FieldLabel>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              aria-invalid={!!signupForm.formState.errors.password}
              {...signupForm.register("password")}
            />
            <FieldError errors={[signupForm.formState.errors.password]} />
          </Field>

          <FieldError>{error}</FieldError>

          <Field>
            <Button disabled={signupMutation.isPending} type="submit">
              {signupMutation.isPending ? "注册中..." : "注册"}
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </div>
  );
}
