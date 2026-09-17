"use client";

import { useEffect, useRef } from "react";

export function usePaginationScrollReset<T extends HTMLElement>(page: number) {
  const ref = useRef<T>(null);

  useEffect(() => {
    ref.current?.scrollTo({ top: 0, behavior: "instant" });
  }, [page]);

  return ref;
}
