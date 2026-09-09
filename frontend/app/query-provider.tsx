"use client";

import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/api-error";

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => {
    const notifiedQueries = new WeakSet();

    return new QueryClient({
      queryCache: new QueryCache({
        onError: (error, query) => {
          if (notifiedQueries.has(query)) return;

          notifiedQueries.add(query);

          toast.error(
            getApiErrorMessage(
              error,
              query.state.data === undefined
                ? "加载失败，请稍后再试"
                : "刷新失败，请稍后再试",
            ),
            { id: query.queryHash },
          );
        },
        onSuccess: (_, query) => {
          notifiedQueries.delete(query);
        },
      }),
    });
  });

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
