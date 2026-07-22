"use client";

import { Thread } from "@/components/thread";
import { Button } from "@/components/ui/button";
import { clearAccessToken, getAccessToken } from "@/lib/auth";
import { useAui, AuiProvider, Suggestions } from "@assistant-ui/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MyRuntimeProvider } from "./MyRuntimeProvider";

function ThreadWithSuggestions() {
  const aui = useAui({
    suggestions: Suggestions([
      {
        title: "厦门今天天气怎么样？",
        prompt: "厦门今天天气怎么样？",
      },
      {
        title: "介绍一下你自己以及你的能力",
        prompt: "你能帮助我做什么？",
      },
    ]),
  });
  return (
    <AuiProvider value={aui}>
      <Thread />
    </AuiProvider>
  );
}

export default function Home() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    if (getAccessToken()) {
      setAuthenticated(true);

      return;
    }

    router.replace("/login");
  }, [router]);

  if (!authenticated) {
    return null;
  }

  function logout() {
    clearAccessToken();
    router.replace("/login");
  }

  return (
    <MyRuntimeProvider>
      <div className="flex h-full flex-col">
        <div className="flex justify-end border-b p-2">
          <Button variant="ghost" onClick={logout}>
            退出登录
          </Button>
        </div>
        <div className="min-h-0 flex-1">
          <ThreadWithSuggestions />
        </div>
      </div>
    </MyRuntimeProvider>
  );
}
