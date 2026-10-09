"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { authExchangeTicket } from "@/lib/client";
import { getApiErrorMessage } from "@/lib/api-error";

const loginButtonClass = "w-full bg-blue-600 text-white hover:bg-blue-600/80";

export function LoginForm() {
  const [pending, setPending] = useState<"dingtalk" | "dev" | null>(null);
  const [error, setError] = useState<string>();
  const [showDevLogin, setShowDevLogin] = useState(false);

  useEffect(() => {
    void fetch("/api/v1/auth/dev-login")
      .then((response) => setShowDevLogin(response.ok))
      .catch(() => {});
  }, []);

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

    setPending("dingtalk");

    void authExchangeTicket({ body: { ticket }, throwOnError: true })
      .then(() => {
        window.location.replace("/admin");
      })
      .catch((cause: unknown) => {
        setError(getApiErrorMessage(cause, "登录未完成，请重新发起钉钉登录"));

        setPending(null);
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

      <div className="space-y-3">
        <Button
          type="button"
          size="lg"
          className={loginButtonClass}
          disabled={pending !== null}
          aria-busy={pending === "dingtalk"}
          onClick={() => window.location.assign("/api/v1/auth/dingtalk")}
        >
          {pending === "dingtalk" ? (
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
        {showDevLogin && (
          <Button
            type="button"
            size="lg"
            className={loginButtonClass}
            disabled={pending !== null}
            aria-busy={pending === "dev"}
            onClick={async () => {
              setPending("dev");
              setError(undefined);
              try {
                const response = await fetch("/api/v1/auth/dev-login", {
                  method: "POST",
                });
                if (!response.ok) throw await response.json();
                window.location.replace("/admin");
              } catch (cause) {
                setError(getApiErrorMessage(cause, "本地测试登录失败"));
                setPending(null);
              }
            }}
          >
            {pending === "dev" ? (
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
            本地模拟钉钉登录
          </Button>
        )}
      </div>
    </div>
  );
}
