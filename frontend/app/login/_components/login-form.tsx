"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { authExchangeTicket } from "@/lib/client";
import { getApiErrorMessage } from "@/lib/api-error";

export function LoginForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const url = new URL(window.location.href);
    const ticket = url.searchParams.get("ticket");
    const hasError = url.searchParams.has("error_code");

    if (!ticket && !hasError) return;

    url.searchParams.delete("ticket");

    url.searchParams.delete("error_code");

    window.history.replaceState(window.history.state, "", url);

    if (hasError) {
      setError("钉钉登录失败，请重新登录");

      return;
    }

    if (!ticket) return;

    setPending(true);

    void authExchangeTicket({ body: { ticket }, throwOnError: true })
      .then(() => {
        window.location.replace("/admin");
      })
      .catch((cause: unknown) => {
        setError(getApiErrorMessage(cause, "登录未完成，请重新发起钉钉登录"));

        setPending(false);
      });
  }, []);

  return (
    <div className="space-y-6">
      <h1 id="login-heading" className="text-center text-2xl font-semibold">
        登录数据中心
      </h1>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Button
        type="button"
        size="lg"
        className="w-full bg-blue-600 text-white hover:bg-blue-600/80"
        disabled={pending}
        aria-busy={pending}
        onClick={() => window.location.assign("/api/v1/auth/dingtalk")}
      >
        {pending ? (
          <Spinner />
        ) : (
          <Image
            src="/brand/dingtalk-symbol.png"
            alt=""
            width={16}
            height={25}
            className="h-5 w-auto invert"
          />
        )}
        钉钉登录
      </Button>
    </div>
  );
}
