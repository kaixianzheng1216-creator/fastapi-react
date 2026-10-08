"use client";

import type { ReactNode } from "react";

import { LoadError } from "@/components/common/load-error";
import { Spinner } from "@/components/ui/spinner";
import { useCurrentUserQuery } from "@/hooks/use-current-user";
import { getApiErrorMessage } from "@/lib/api-error";

export function AuthenticatedGuard({ children }: { children: ReactNode }) {
  const user = useCurrentUserQuery();

  if (user.isPending) {
    return (
      <div className="flex h-svh items-center justify-center">
        <Spinner aria-label="正在验证登录" />
      </div>
    );
  }

  if (user.isError) {
    return (
      <div className="flex h-svh items-center justify-center">
        <LoadError
          title={getApiErrorMessage(user.error, "无法验证登录，请稍后重试")}
          onRetry={() => void user.refetch()}
          isRetrying={user.isFetching}
        />
      </div>
    );
  }

  return children;
}
