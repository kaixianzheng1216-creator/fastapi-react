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
      defaultOptions: {
        queries: { retry: false },
      },
      queryCache: new QueryCache({
        onError: (error) => {
          toast.error(
            getApiErrorMessage(error, "数据请求失败，请稍后再试"),
            { id: "query-error" },
          );
        },
      }),
    });
  });

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
