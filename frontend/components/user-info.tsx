"use client";

import { useEffect, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getAccessToken } from "@/lib/auth";
import { type UserPublic, usersReadUserMe } from "@/lib/client";

export function useCurrentUser(): UserPublic | undefined {
  const [user, setUser] = useState<UserPublic>();

  useEffect(() => {
    void usersReadUserMe({
      auth: getAccessToken()!,
      throwOnError: true,
    }).then(({ data }) => setUser(data));
  }, []);

  return user;
}

export function UserProfile({ user }: { user: UserPublic }) {
  return (
    <>
      <Avatar className="size-8">
        <AvatarFallback>
          {user.username.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1 truncate">{user.username}</span>
    </>
  );
}
