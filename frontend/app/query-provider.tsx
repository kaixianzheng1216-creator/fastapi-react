"use client";

import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";

import { getApiErrorMessage } from "@/lib/api-error";

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => {
    return new QueryClient({
      queryCache: new QueryCache({
        onError: (error, query) => {
          const isRefresh = query.state.data !== undefined;

          toast.error(
            getApiErrorMessage(
              error,
              isRefresh ? "刷新失败，请稍后再试" : "加载失败，请稍后再试",
            ),
            { id: isRefresh ? "query-refresh-error" : "query-load-error" },
          );
        },
      }),
    });
  });

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
