"use client";

import type * as React from "react";
import {
  ArchiveIcon,
  ChevronRightIcon,
  FolderTreeIcon,
  LogOutIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppearanceMenu } from "@/components/appearance-menu";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";

export function ThreadListSidebar({
  activeView,
  onShowConversation,
  onShowSkills,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  activeView: "conversation" | "skills";
  onShowConversation: () => void;
  onShowSkills: () => void;
}) {
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
          <ThreadListNew
            onClick={onShowConversation}
            className={cn(
              activeView === "skills" &&
                "data-active:bg-transparent data-active:font-normal data-active:shadow-none data-active:hover:bg-muted",
            )}
          />
          <Button
            variant="ghost"
            onClick={onShowSkills}
            className={cn(
              "h-8 justify-start px-2.5 font-normal",
              activeView === "skills" &&
                "bg-background font-semibold shadow-sm hover:bg-background",
            )}
          >
            <FolderTreeIcon data-icon="inline-start" />
            Skills
          </Button>
        </SidebarHeader>
        <SidebarContent className="px-3 pb-3" onClick={onShowConversation}>
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
        )}
      </SidebarFooter>

      <ThreadListSearch
        archived
        open={isArchivedDialogOpen}
        onOpenChange={setIsArchivedDialogOpen}
      />
    </Sidebar>
  );
}
