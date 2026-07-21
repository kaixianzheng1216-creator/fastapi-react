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
import { saveAccessToken } from "@/lib/auth"
import { cn } from "@/lib/utils"

type LoginResponse = {
  access_token: string
}

type ErrorResponse = {
  detail?: string
}

export function LoginForm({
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
    const username = String(formData.get("username"))
    const password = String(formData.get("password"))

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ username, password }),
      })

      if (!response.ok) {
        const body = (await response.json()) as ErrorResponse
        setError(body.detail ?? "登录失败")

        return
      }

      const body = (await response.json()) as LoginResponse
      saveAccessToken(body.access_token)
      router.replace("/")
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
            <h1 className="text-xl font-bold">登录 AI 助手</h1>
            <FieldDescription>
              还没有账号？<Link href="/signup">立即注册</Link>
            </FieldDescription>
          </div>

          <Field>
            <FieldLabel htmlFor="username">用户名</FieldLabel>
            <Input
              id="username"
              name="username"
              autoComplete="username"
              required
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="password">密码</FieldLabel>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>

          <FieldError>{error}</FieldError>

          <Field>
            <Button disabled={submitting} type="submit">
              {submitting ? "登录中..." : "登录"}
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </div>
  )
}
