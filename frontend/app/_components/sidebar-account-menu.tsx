"use client";

import { ChevronRightIcon, LogOutIcon } from "lucide-react";
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
import { useLogout } from "@/hooks/use-logout";
import type { UserPublic } from "@/lib/client";

export function SidebarAccountMenu({
  user,
  children,
}: {
  user?: UserPublic;
  children?: ReactNode;
}) {
  const logout = useLogout();

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
            <DropdownMenuItem
              disabled={logout.isPending}
              onSelect={() => logout.mutate()}
            >
              <LogOutIcon />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}
