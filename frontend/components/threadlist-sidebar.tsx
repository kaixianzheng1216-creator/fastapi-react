"use client";

import type * as React from "react";
import { ChevronRightIcon, LogOutIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { ThreadList } from "@/components/thread-list";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { clearAccessToken } from "@/lib/auth";
import { useCurrentUser, UserProfile } from "@/components/user-info";

export function ThreadListSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const router = useRouter();
  const user = useCurrentUser();

  function logOut(): void {
    clearAccessToken();
    router.replace("/login");
  }

  return (
    <Sidebar {...props}>
      <SidebarContent className="aui-sidebar-content px-3 py-3">
        <ThreadList />
      </SidebarContent>
      <SidebarRail />
      <SidebarFooter className="aui-sidebar-footer border-t">
        {user && (
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton size="lg">
                    <UserProfile user={user} />
                    <ChevronRightIcon />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="top"
                  align="start"
                  className="w-48"
                >
                  <DropdownMenuItem onClick={logOut}>
                    <LogOutIcon />
                    退出登录
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
