"use client";

import type * as React from "react";
import { ChevronRightIcon, LogOutIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  ThreadListItems,
  ThreadListNew,
  ThreadListRoot,
  ThreadListSearch,
} from "@/components/thread-list";
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
  SidebarHeader,
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
      <ThreadListRoot className="min-h-0 flex-1 gap-0">
        <SidebarHeader className="p-3 pb-2">
          <ThreadListSearch />
          <ThreadListNew />
        </SidebarHeader>
        <SidebarContent className="px-3 pb-3">
          <ThreadListItems />
        </SidebarContent>
      </ThreadListRoot>
      <SidebarRail />
      <SidebarFooter className="border-t">
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
                <DropdownMenuContent side="top" align="start" className="w-48">
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
