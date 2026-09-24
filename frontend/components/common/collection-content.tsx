import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export const CARD_PAGE_SIZE = 12;

type CollectionContentProps = {
  busy: boolean;
  inert?: boolean;
  children: ReactNode;
  className?: string;
};

export function CollectionContent({
  busy,
  inert = false,
  children,
  className,
}: CollectionContentProps) {
  return (
    <div
      aria-busy={busy}
      inert={inert}
      className={cn("aria-busy:opacity-60", className)}
    >
      {children}
    </div>
  );
}

export function CardGrid({
  busy = false,
  inert = false,
  children,
  label,
}: {
  busy?: boolean;
  inert?: boolean;
  children: ReactNode;
  label: string;
}) {
  return (
    <ul
      aria-label={label}
      aria-busy={busy}
      inert={inert}
      className="grid grid-cols-1 gap-4 aria-busy:opacity-60 md:grid-cols-2 xl:grid-cols-3"
    >
      {children}
    </ul>
  );
}
