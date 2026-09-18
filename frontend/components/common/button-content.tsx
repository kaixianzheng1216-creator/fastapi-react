import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Spinner } from "@/components/ui/spinner";

export function ButtonContent({
  loading,
  icon: Icon,
  children,
}: {
  loading: boolean;
  icon?: LucideIcon;
  children?: ReactNode;
}) {
  if (Icon) {
    const LeadingIcon = loading ? Spinner : Icon;

    return (
      <>
        <LeadingIcon
          data-icon="inline-start"
          aria-hidden="true"
        />
        {children}
      </>
    );
  }

  return (
    <span className="relative inline-flex items-center justify-center">
      <span className={loading ? "opacity-0" : undefined}>
        {children}
      </span>
      {loading ? (
        <Spinner className="absolute" aria-hidden="true" />
      ) : null}
    </span>
  );
}
