"use client";

import { useRef, type RefObject, type SyntheticEvent } from "react";

export function useActionFocus(fallbackRef: RefObject<HTMLElement | null>) {
  const triggerRef = useRef<HTMLElement>(null);

  const rememberActionTrigger = (event: SyntheticEvent<HTMLElement>) => {
    triggerRef.current = event.currentTarget;
  };

  const restoreActionFocus = (event: Event) => {
    event.preventDefault();
    const trigger = triggerRef.current;
    const target =
      trigger?.isConnected && !trigger.closest("[inert]")
        ? trigger
        : fallbackRef.current;
    target?.focus({ preventScroll: true });
  };

  const clearActionTrigger = () => {
    triggerRef.current = null;
  };

  return { rememberActionTrigger, restoreActionFocus, clearActionTrigger };
}
