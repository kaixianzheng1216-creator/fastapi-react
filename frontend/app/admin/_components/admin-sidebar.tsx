"use client";

import {
  BookOpenIcon,
  ChevronRightIcon,
  FileTextIcon,
  GlobeIcon,
  MessageSquareIcon,
  TagIcon,
  UserIcon,
  UsersIcon,
  WaypointsIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { SidebarAccountMenu } from "@/app/_components/sidebar-account-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import type { UserPublic } from "@/lib/client";

const businessModules = [
  {
    name: "品牌营销",
    icon: TagIcon,
    items: [
      {
        name: "区域数据",
        href: "/admin/brand-marketing/regional-data",
      },
    ],
  },
  { name: "内容运营", icon: FileTextIcon, items: [] },
  { name: "达人投放", icon: UsersIcon, items: [] },
  { name: "海外营销", icon: GlobeIcon, items: [] },
];

export function AdminSidebar({ user }: { user: UserPublic }) {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg">
              <Link href="/admin/users">
                <span className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <WaypointsIcon aria-hidden="true" className="size-4" />
                </span>
                <span className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-semibold">数据中台</span>
                  <span className="truncate text-[10px] font-medium tracking-[0.16em] text-muted-foreground">
                    DATA HUB
                  </span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname.startsWith("/admin/users")}
                  tooltip="用户"
                >
                  <Link href="/admin/users">
                    <UserIcon aria-hidden="true" />
                    <span>用户</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname.startsWith("/admin/knowledge-bases")}
                  tooltip="知识库"
                >
                  <Link href="/admin/knowledge-bases">
                    <BookOpenIcon aria-hidden="true" />
                    <span>知识库</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {businessModules.map((module) => {
                const moduleIsActive = module.items.some((item) =>
                  pathname.startsWith(item.href),
                );

                return (
                  <Collapsible
                    key={module.name}
                    asChild
                    defaultOpen={moduleIsActive}
                  >
                    <SidebarMenuItem className="group/collapsible">
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          isActive={moduleIsActive}
                          tooltip={module.name}
                        >
                          <module.icon aria-hidden="true" />
                          <span>{module.name}</span>
                          <ChevronRightIcon
                            aria-hidden="true"
                            className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90"
                          />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {module.items.length > 0 ? (
                            module.items.map((item) => (
                              <SidebarMenuSubItem key={item.href}>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={pathname.startsWith(item.href)}
                                  className="data-[active=true]:bg-transparent data-[active=true]:font-medium"
                                >
                                  <Link href={item.href}>{item.name}</Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))
                          ) : (
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton aria-disabled="true">
                                <span>暂未配置</span>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          )}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarSeparator className="mx-0" />
        <SidebarMenu>
          <SidebarAccountMenu user={user}>
            <DropdownMenuItem asChild>
              <Link href="/">
                <MessageSquareIcon aria-hidden="true" />
                返回聊天
              </Link>
            </DropdownMenuItem>
          </SidebarAccountMenu>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
