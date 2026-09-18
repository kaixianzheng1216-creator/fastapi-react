"use client";

import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";

export function useCopyToClipboard({
  onSuccess,
  errorMessage = "复制失败，请手动选择并复制文本",
}: {
  onSuccess?: () => void;
  errorMessage?: string;
} = {}) {
  const { mutate, isPending, isSuccess, reset } = useMutation({
    mutationFn: (value: string) => navigator.clipboard.writeText(value),
    onSuccess,
    onError: () => toast.error(errorMessage),
  });

  useEffect(() => {
    if (!isSuccess) return;
    const timer = setTimeout(reset, 3000);
    return () => clearTimeout(timer);
  }, [isSuccess, reset]);

  return {
    isCopied: isSuccess,
    isCopying: isPending,
    copyToClipboard: (value: string) => {
      if (value && !isPending) mutate(value);
    },
  };
}
