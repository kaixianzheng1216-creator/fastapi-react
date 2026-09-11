"use client";

import {
  type LucideIcon,
  BookOpenIcon,
  FolderOpenIcon,
  ChevronRightIcon,
  FileTextIcon,
  GlobeIcon,
  MessageSquareIcon,
  PlugIcon,
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

type NavigationLink = {
  name: string;
  href: string;
};

type NavigationItem = { name: string; icon: LucideIcon } & (
  | { type: "link"; href: string }
  | { type: "group"; items: readonly NavigationLink[] }
);

const navigation: {
  main: readonly NavigationItem[];
  footer: readonly NavigationItem[];
} = {
  main: [
    {
      type: "link",
      name: "用户",
      icon: UserIcon,
      href: "/admin/users",
    },
    {
      type: "link",
      name: "文件库",
      icon: FolderOpenIcon,
      href: "/admin/file-libraries",
    },
    {
      type: "link",
      name: "知识库",
      icon: BookOpenIcon,
      href: "/admin/knowledge-bases",
    },
    {
      type: "group",
      name: "品牌营销",
      icon: TagIcon,
      items: [
        {
          name: "区域数据",
          href: "/admin/brand-marketing/regional-data",
        },
      ],
    },
    {
      type: "group",
      name: "内容运营",
      icon: FileTextIcon,
      items: [
        {
          name: "平台榜单",
          href: "/admin/content-operations/rankings",
        },
        {
          name: "内容搜索",
          href: "/admin/content-operations/search",
        },
        {
          name: "热门内容",
          href: "/admin/content-operations/hot-content",
        },
        {
          name: "热门关键词",
          href: "/admin/content-operations/hot-keywords",
        },
        {
          name: "增长关键词",
          href: "/admin/content-operations/growing-keywords",
        },
      ],
    },
    {
      type: "group",
      name: "达人投放",
      icon: UsersIcon,
      items: [
        {
          name: "达人资源",
          href: "/admin/influencer-marketing/resources",
        },
      ],
    },
    {
      type: "group",
      name: "海外营销",
      icon: GlobeIcon,
      items: [
        {
          name: "海外营销",
          href: "/admin/overseas-marketing",
        },
      ],
    },
  ],
  footer: [
    {
      type: "link",
      name: "MCP 接入",
      icon: PlugIcon,
      href: "/admin/mcp",
    },
  ],
};

function isPathActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function AdminNavigation({
  items,
  pathname,
}: {
  items: readonly NavigationItem[];
  pathname: string;
}) {
  return (
    <SidebarMenu>
      {items.map((item) => (
        <AdminNavigationItem key={item.name} item={item} pathname={pathname} />
      ))}
    </SidebarMenu>
  );
}

function AdminNavigationItem({
  item,
  pathname,
}: {
  item: NavigationItem;
  pathname: string;
}) {
  if (item.type === "link") {
    const isActive = isPathActive(pathname, item.href);

    return (
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={isActive} tooltip={item.name}>
          <Link href={item.href} aria-current={isActive ? "page" : undefined}>
            <item.icon aria-hidden="true" />
            <span>{item.name}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  const isActive = item.items.some((child) => isPathActive(pathname, child.href));

  return (
    <Collapsible asChild defaultOpen={isActive}>
      <SidebarMenuItem className="group/collapsible">
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            isActive={isActive}
            className="data-[active=true]:bg-transparent"
            tooltip={item.name}
          >
            <item.icon aria-hidden="true" />
            <span>{item.name}</span>
            <ChevronRightIcon
              aria-hidden="true"
              className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90"
            />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {item.items.length > 0 ? (
              item.items.map((child) => {
                const childIsActive = isPathActive(pathname, child.href);

                return (
                  <SidebarMenuSubItem key={child.href}>
                    <SidebarMenuSubButton asChild isActive={childIsActive}>
                      <Link
                        href={child.href}
                        aria-current={childIsActive ? "page" : undefined}
                      >
                        {child.name}
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                );
              })
            ) : (
              <SidebarMenuSubItem>
                <SidebarMenuSubButton asChild aria-disabled="true">
                  <span>暂未配置</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            )}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

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
            <AdminNavigation items={navigation.main} pathname={pathname} />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <AdminNavigation items={navigation.footer} pathname={pathname} />

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
