"use client";

import { ChevronRightIcon, LogOutIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { AppearanceMenu } from "@/app/_components/appearance-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { UserProfile } from "@/app/_components/user-info";
import { CURRENT_USER_QUERY_KEY } from "@/hooks/use-current-user";
import { clearAccessToken } from "@/lib/auth";
import type { UserPublic } from "@/lib/client";

export function SidebarAccountMenu({
  user,
  children,
}: {
  user?: UserPublic;
  children?: ReactNode;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  function logOut(): void {
    clearAccessToken();
    queryClient.removeQueries({ queryKey: CURRENT_USER_QUERY_KEY });
    router.replace("/login");
  }

  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton size="lg">
            <UserProfile user={user} />
            <ChevronRightIcon />
          </SidebarMenuButton>
        </DropdownMenuTrigger>

        <DropdownMenuContent side="top" align="start" className="w-56">
          <DropdownMenuGroup>
            {children}
            <AppearanceMenu />
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={logOut}>
              <LogOutIcon />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}
