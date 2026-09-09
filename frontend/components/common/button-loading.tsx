import type { ReactNode } from "react";

import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export function ButtonLoading({
  loading,
  children,
}: {
  loading: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <span className={cn(loading && "opacity-0")}>{children}</span>
      {loading ? (
        <span
          className="absolute inset-0 flex items-center justify-center"
          aria-hidden="true"
        >
          <Spinner aria-hidden="true" />
        </span>
      ) : null}
    </>
  );
}
