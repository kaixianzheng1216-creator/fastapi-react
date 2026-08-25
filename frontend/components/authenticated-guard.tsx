"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

import { Spinner } from "@/components/ui/spinner";
import { configureApiClient, getAccessToken } from "@/lib/auth";

export function AuthenticatedGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }

    configureApiClient();

    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="flex h-svh items-center justify-center">
        <Spinner aria-label="正在加载页面" />
      </div>
    );
  }

  return children;
}
