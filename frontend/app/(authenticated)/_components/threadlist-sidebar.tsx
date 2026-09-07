"use client";

import type * as React from "react";
import { ArchiveIcon, PuzzleIcon, ShieldCheckIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ThreadListItems,
  ThreadListNew,
  ThreadListRoot,
  ThreadListSearch,
} from "@/app/(authenticated)/_components/thread-list";
import { SidebarItemButton } from "@/app/(authenticated)/_components/sidebar-item-button";
import { SidebarAccountMenu } from "@/app/_components/sidebar-account-menu";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { useCurrentUser } from "@/hooks/use-current-user";

export function ThreadListSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const user = useCurrentUser();
  const [isArchivedDialogOpen, setIsArchivedDialogOpen] = useState(false);

  return (
    <Sidebar {...props}>
      <ThreadListRoot className="min-h-0 flex-1 gap-0">
        <SidebarHeader className="p-3 pb-2">
          <ThreadListSearch />
          <ThreadListNew />
          <ThreadListNew kind="research" />
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
      <SidebarFooter>
        <SidebarSeparator className="mx-0" />
        <SidebarMenu>
          <SidebarAccountMenu user={user}>
            {user?.is_superuser && (
              <DropdownMenuItem asChild>
                <Link href="/admin/users">
                  <ShieldCheckIcon />
                  管理后台
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => setIsArchivedDialogOpen(true)}>
              <ArchiveIcon />
              已归档对话
            </DropdownMenuItem>
          </SidebarAccountMenu>
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
