"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { authLogout } from "@/lib/client";
import { getApiErrorMessage } from "@/lib/api-error";

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => authLogout({ throwOnError: true }),
    onSuccess: () => {
      queryClient.clear();
      window.location.replace("/login");
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "退出失败，请重试")),
  });
}
