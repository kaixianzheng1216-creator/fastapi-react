"use client";

import { useQuery } from "@tanstack/react-query";

import { usersReadUserMe } from "@/lib/client";

export const CURRENT_USER_QUERY_KEY = ["current-user"] as const;

export function useCurrentUserQuery() {
  return useQuery({
    queryKey: CURRENT_USER_QUERY_KEY,
    queryFn: async () => {
      const { data } = await usersReadUserMe({
        throwOnError: true,
      });

      return data;
    },
    retry: false,
    staleTime: Infinity,
  });
}

export function useCurrentUser() {
  return useCurrentUserQuery().data;
}
