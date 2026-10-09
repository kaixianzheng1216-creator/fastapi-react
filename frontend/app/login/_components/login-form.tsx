"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { authExchangeTicket } from "@/lib/client";
import { getApiErrorMessage } from "@/lib/api-error";

export function LoginForm({
  title = "登录数据中心",
  description,
  returnTo = "/admin",
}: {
  title?: string;
  description?: string;
  returnTo?: string;
}) {
  const [pending, setPending] = useState<"dingtalk" | "dev" | null>(null);
  const [error, setError] = useState<string>();
  const [showDevLogin, setShowDevLogin] = useState(false);

  const destination = useRef(returnTo);

  useEffect(() => {
    void fetch("/api/v1/auth/dev-login")
      .then((response) => setShowDevLogin(response.ok))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const resetPending = (event: PageTransitionEvent) => {
      if (event.persisted) setPending(null);
    };

    window.addEventListener("pageshow", resetPending);

    return () => window.removeEventListener("pageshow", resetPending);
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const ticket = url.searchParams.get("ticket");
    const hasError = url.searchParams.has("error_code");

    if (!ticket && !hasError) return;

    const saved = sessionStorage.getItem("login-return-to");

    if (saved && /^\/invite\/[A-Za-z0-9_-]{43}$/.test(saved)) {
      destination.current = saved;
    }

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
        sessionStorage.removeItem("login-return-to");
        window.location.replace(destination.current);
      })
      .catch((cause: unknown) => {
        setError(getApiErrorMessage(cause, "登录未完成，请重新发起钉钉登录"));

        setPending(null);
      });
  }, []);

  async function login(method: "dingtalk" | "dev") {
    setPending(method);
    setError(undefined);

    if (method === "dingtalk") {
      sessionStorage.setItem("login-return-to", destination.current);
      window.location.assign("/api/v1/auth/dingtalk");

      return;
    }

    try {
      const response = await fetch("/api/v1/auth/dev-login", { method: "POST" });

      if (!response.ok) throw await response.json();

      sessionStorage.removeItem("login-return-to");
      window.location.replace(destination.current);
    } catch (cause) {
      setError(getApiErrorMessage(cause, "本地测试登录失败"));
      setPending(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5 text-center">
        <h1
          id="login-heading"
          className="break-words text-2xl font-semibold tracking-tight"
        >
          {title}
        </h1>

        {description && (
          <p className="break-words text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="space-y-3">
        {(["dingtalk", "dev"] as const).map((method) =>
          method === "dev" && !showDevLogin ? null : (
            <Button
              key={method}
              type="button"
              size="lg"
              className="w-full bg-blue-600 text-white hover:bg-blue-600/80"
              disabled={pending !== null}
              aria-busy={pending === method}
              onClick={() => void login(method)}
            >
              {pending === method ? (
                <Spinner aria-hidden="true" />
              ) : (
                <Image
                  src="/brand/dingtalk-symbol.png"
                  alt=""
                  width={16}
                  height={25}
                  className="h-5 w-auto invert"
                />
              )}

              {method === "dingtalk" ? "钉钉登录" : "本地模拟钉钉登录"}
            </Button>
          ),
        )}
      </div>
    </div>
  );
}
