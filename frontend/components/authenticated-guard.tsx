"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

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

  return ready ? children : null;
}
