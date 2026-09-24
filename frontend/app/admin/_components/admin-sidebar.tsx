"use client";

import {
  type LucideIcon,
  BookOpenIcon,
  ChevronRightIcon,
  FileTextIcon,
  FolderKanbanIcon,
  GlobeIcon,
  PlugIcon,
  TagIcon,
  UsersIcon,
  WaypointsIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";

import { SidebarAccountMenu } from "@/app/_components/sidebar-account-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  useSidebar,
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
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectPicker } from "./project-picker";
import { useProject, useProjectLoading } from "./project-context";
import { projectHref, projectMembersHref } from "@/lib/project-routes";
import type { UserPublic } from "@/lib/client";

type NavigationLink = {
  name: string;
  href: string;
};

type NavigationItem = { name: string; icon: LucideIcon } & (
  | { type: "link"; href?: string }
  | { type: "group"; items: readonly NavigationLink[] }
);

const navigation: {
  main: readonly NavigationItem[];
} = {
  main: [
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
};

function isPathActive(pathname: string, href: string) {
  const path = href.split("?")[0];
  return pathname === path || pathname.startsWith(`${path}/`);
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
    const isActive = !!item.href && isPathActive(pathname, item.href);
    const label = (
      <>
        <item.icon aria-hidden="true" />
        <span>{item.name}</span>
      </>
    );

    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild={!!item.href}
          disabled={!item.href}
          isActive={isActive}
          tooltip={item.name}
        >
          {item.href ? (
            <Link href={item.href} aria-current={isActive ? "page" : undefined}>
              {label}
            </Link>
          ) : (
            label
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  const isActive = item.items.some((child) =>
    isPathActive(pathname, child.href),
  );

  return (
    <Collapsible asChild defaultOpen={isActive}>
      <SidebarMenuItem className="group/collapsible">
        <CollapsibleTrigger asChild>
          <SidebarMenuButton isActive={isActive} tooltip={item.name}>
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
            {item.items.map((child) => {
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
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

export function AdminSidebar({ user }: { user: UserPublic }) {
  const pathname = usePathname();
  const router = useRouter();
  const project = useProject();
  const projectLoading = useProjectLoading();
  const { setOpenMobile } = useSidebar();

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg">
              <Link href="/admin">
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
        <ProjectPicker
          current={project}
          onSelect={(next) => {
            setOpenMobile(false);
            const href =
              user.is_superuser || next.role === "admin"
                ? projectMembersHref(next.id)
                : projectHref(next.id);
            router.push(href);
          }}
        />
      </SidebarHeader>

      <SidebarContent
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("a")) setOpenMobile(false);
        }}
      >
        {user.is_superuser && (
          <SidebarGroup>
            <SidebarGroupLabel>平台管理</SidebarGroupLabel>
            <SidebarGroupContent>
              <AdminNavigation
                pathname={pathname}
                items={[
                  {
                    type: "link",
                    name: "项目管理",
                    icon: FolderKanbanIcon,
                    href: "/admin/manage",
                  },
                  {
                    type: "link",
                    name: "用户管理",
                    icon: UsersIcon,
                    href: "/admin/users",
                  },
                ]}
              />
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        <SidebarGroup>
          <SidebarGroupLabel>项目资源</SidebarGroupLabel>
          <SidebarGroupContent>
            {projectLoading && !user.is_superuser ? (
              <SidebarMenu aria-label="加载项目菜单" aria-busy="true">
                {[0, 1].map((item) => (
                  <SidebarMenuItem key={item}>
                    <Skeleton className="h-8" />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            ) : (
              <AdminNavigation
                pathname={pathname}
                items={[
                  ...(user.is_superuser || project?.role === "admin"
                    ? [
                        {
                          type: "link" as const,
                          name: "项目成员",
                          icon: UsersIcon,
                          href: project
                            ? projectMembersHref(project.id)
                            : undefined,
                        },
                      ]
                    : []),
                  {
                    type: "link",
                    name: "知识库",
                    icon: BookOpenIcon,
                    href: project ? projectHref(project.id) : undefined,
                  },
                ]}
              />
            )}
          </SidebarGroupContent>
        </SidebarGroup>
        {user.is_superuser && (
          <SidebarGroup>
            <SidebarGroupLabel>业务工具</SidebarGroupLabel>
            <SidebarGroupContent>
              <AdminNavigation items={navigation.main} pathname={pathname} />
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("a")) setOpenMobile(false);
        }}
      >
        <AdminNavigation
          items={[
            {
              type: "link",
              name: "MCP 接入",
              icon: PlugIcon,
              href: project
                ? `/admin/projects/${project.id}/mcp`
                : undefined,
            },
          ]}
          pathname={pathname}
        />

        <SidebarSeparator className="mx-0" />
        <SidebarMenu>
          <SidebarAccountMenu user={user} />
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
