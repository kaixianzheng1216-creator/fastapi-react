import type { ReactNode } from "react";

export const CARD_PAGE_SIZE = 12;

type CollectionContentProps = {
  busy: boolean;
  children: ReactNode;
  className?: string;
};

export function CollectionContent({
  busy,
  children,
  className,
}: CollectionContentProps) {
  return (
    <div
      aria-busy={busy}
      className="transition-opacity aria-busy:opacity-60 motion-reduce:transition-none"
    >
      <div inert={busy} className={className}>
        {children}
      </div>
    </div>
  );
}

export function CardGrid({
  busy = false,
  children,
  label,
}: {
  busy?: boolean;
  children: ReactNode;
  label: string;
}) {
  return (
    <div
      aria-busy={busy}
      className="transition-opacity aria-busy:opacity-60 motion-reduce:transition-none"
    >
      <ul
        aria-label={label}
        inert={busy}
        className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
      >
        {children}
      </ul>
    </div>
  );
}
