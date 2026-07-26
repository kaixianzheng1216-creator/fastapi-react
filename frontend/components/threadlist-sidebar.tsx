"use client";

import type * as React from "react";
import { LogOutIcon, Repeat2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ThreadList } from "@/components/thread-list";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { clearAccessToken, getAccessToken } from "@/lib/auth";
import { type UserPublic, usersReadUserMe } from "@/lib/client";

export function ThreadListSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const router = useRouter();
  const [user, setUser] = useState<UserPublic>();

  useEffect(() => {
    void usersReadUserMe({
      auth: getAccessToken()!,
      throwOnError: true,
    }).then(({ data }) => setUser(data));
  }, []);

  function changeAccount(): void {
    clearAccessToken();
    router.push("/login");
  }

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
                    <Avatar size="sm">
                      <AvatarFallback>
                        {user.username.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span>{user.username}</span>
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start">
                  <DropdownMenuItem onClick={changeAccount}>
                    <Repeat2Icon />
                    切换账号
                  </DropdownMenuItem>
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
