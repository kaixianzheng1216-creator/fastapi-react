"use client"

import { GalleryVerticalEnd } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { type FormEvent, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type ErrorResponse = {
  detail?: string
}

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setSubmitting(true)

    const formData = new FormData(event.currentTarget)
    const fullName = String(formData.get("fullName"))
    const username = String(formData.get("username"))
    const password = String(formData.get("password"))

    try {
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          full_name: fullName || null,
          username,
          password,
        }),
      })

      if (!response.ok) {
        const body = (await response.json()) as ErrorResponse
        setError(body.detail ?? "注册失败")

        return
      }

      router.replace("/login")
    } catch {
      setError("无法连接到服务器")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <form onSubmit={handleSubmit}>
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

          <Field>
            <FieldLabel htmlFor="fullName">昵称（可选）</FieldLabel>
            <Input
              id="fullName"
              name="fullName"
              autoComplete="name"
              maxLength={255}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="username">用户名</FieldLabel>
            <Input
              id="username"
              name="username"
              autoComplete="username"
              minLength={3}
              maxLength={255}
              required
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="password">密码</FieldLabel>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
            />
          </Field>

          <FieldError>{error}</FieldError>

          <Field>
            <Button disabled={submitting} type="submit">
              {submitting ? "注册中..." : "注册"}
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </div>
  )
}
