"use client";

import { Thread } from "@/components/thread";
import { TodoList } from "@/components/todo-list";
import { getAccessToken } from "@/lib/auth";
import { useAui, AuiProvider, Suggestions } from "@assistant-ui/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MyRuntimeProvider } from "./MyRuntimeProvider";

function ThreadWithSuggestions() {
  const aui = useAui({
    suggestions: Suggestions([
      {
        title: "厦门今天天气怎么样？",
        label: "",
        prompt: "厦门今天天气怎么样？",
      },
      {
        title: "介绍一下你自己以及你的能力",
        label: "",
        prompt: "你能帮助我做什么？",
      },
    ]),
  });
  return (
    <AuiProvider value={aui}>
      <div className="grid h-full min-h-0 grid-cols-1 grid-rows-[minmax(0,1fr)] 2xl:grid-cols-[1fr_minmax(0,44rem)_1fr]">
        <div className="hidden 2xl:block" />
        <div className="min-h-0 min-w-0">
          <Thread />
        </div>
        <TodoList />
      </div>
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

  return (
    <MyRuntimeProvider>
      <ThreadWithSuggestions />
    </MyRuntimeProvider>
  );
}
