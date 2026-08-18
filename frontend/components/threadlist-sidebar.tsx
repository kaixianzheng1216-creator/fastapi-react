"use client";

import type * as React from "react";
import {
  ArchiveIcon,
  ChevronRightIcon,
  LogOutIcon,
  PuzzleIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  ThreadListItems,
  ThreadListNew,
  ThreadListRoot,
  ThreadListSearch,
} from "@/components/thread-list";
import { SidebarItemButton } from "@/components/sidebar-item-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppearanceMenu } from "@/components/appearance-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { clearAccessToken } from "@/lib/auth";
import { useCurrentUser, UserProfile } from "@/components/user-info";

export function ThreadListSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useCurrentUser();
  const [isArchivedDialogOpen, setIsArchivedDialogOpen] = useState(false);

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
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarItemButton
                asChild
                isActive={pathname.startsWith("/skills")}
              >
                <Link href="/skills">
                  <PuzzleIcon />
                  <span>技能</span>
                </Link>
              </SidebarItemButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent className="px-3 pb-3">
          <ThreadListItems />
        </SidebarContent>
      </ThreadListRoot>
      <SidebarRail />
      <SidebarSeparator />
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg">
                  <UserProfile user={user} />
                  <ChevronRightIcon />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start">
                <DropdownMenuItem
                  onSelect={() => setIsArchivedDialogOpen(true)}
                >
                  <ArchiveIcon />
                  已归档对话
                </DropdownMenuItem>
                <AppearanceMenu />
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logOut}>
                  <LogOutIcon />
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <ThreadListSearch
        archived
        open={isArchivedDialogOpen}
        onOpenChange={setIsArchivedDialogOpen}
      />
    </Sidebar>
  );
}
