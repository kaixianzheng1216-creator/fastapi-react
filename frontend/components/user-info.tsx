"use client";

import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { type UserPublic, usersReadUserMe } from "@/lib/client";

export function useCurrentUser(): UserPublic | undefined {
  const { data } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data } = await usersReadUserMe({
        throwOnError: true,
      });

      return data;
    },
    retry: false,
    staleTime: Infinity,
  });

  return data;
}

export function UserProfile({ user }: { user?: UserPublic }) {
  const username = user?.username ?? "账户";

  return (
    <>
      <Avatar className="size-8">
        <AvatarFallback>{username.charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1 truncate">{username}</span>
    </>
  );
}
