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
import { loginLoginAccessToken } from "@/lib/client"
import { getApiErrorMessage } from "@/lib/api-error"
import { saveAccessToken } from "@/lib/auth"
import { cn } from "@/lib/utils"

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
      const { data, error } = await loginLoginAccessToken({
        body: {
          username,
          password,
        },
      })

      if (!data) {
        setError(getApiErrorMessage(error, "登录失败"))

        return
      }

      saveAccessToken(data.access_token)
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
            <h1 className="text-xl font-bold">登录账号</h1>
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
