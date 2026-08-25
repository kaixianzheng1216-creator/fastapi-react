import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { UserPublic } from "@/lib/client";

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
