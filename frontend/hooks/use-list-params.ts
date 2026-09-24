"use client";

import { useSearchParams } from "next/navigation";

export function useListParams() {
  const params = useSearchParams();

  function update(values: Record<string, string>) {
    const next = new URL(window.location.href);
    next.searchParams.delete("page");

    for (const [key, value] of Object.entries(values)) {
      if (value) next.searchParams.set(key, value);
      else next.searchParams.delete(key);
    }

    window.history.replaceState(null, "", next);
  }

  return { params, update };
}
