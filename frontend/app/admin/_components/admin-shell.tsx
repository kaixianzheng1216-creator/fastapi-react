"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CircleAlertIcon } from "lucide-react";
import { Suspense, type ReactNode } from "react";

import { ProjectProvider } from "./project-context";
import { AdminSidebar } from "@/app/admin/_components/admin-sidebar";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { useCurrentUserQuery } from "@/hooks/use-current-user";
import { clearAccessToken } from "@/lib/auth";

function AdminShellState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  const queryClient = useQueryClient();

  function logOut(): void {
    clearAccessToken();
    queryClient.clear();
    window.location.replace("/login");
  }

  return (
    <main className="flex min-h-svh">
      <Empty role="status">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CircleAlertIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>{title}</EmptyTitle>
          {description && <EmptyDescription>{description}</EmptyDescription>}
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={logOut} variant="outline" size="sm">
            退出登录
          </Button>
        </EmptyContent>
      </Empty>
    </main>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const currentUserQuery = useCurrentUserQuery();

  if (currentUserQuery.isPending) {
    return (
      <div className="flex h-svh items-center justify-center">
        <Spinner aria-label="正在加载页面" />
      </div>
    );
  }

  if (!currentUserQuery.data) {
    return <AdminShellState title="账户信息不可用" />;
  }

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <Suspense fallback={<Spinner aria-label="加载项目" />}>
        <ProjectProvider
          key={currentUserQuery.data.id}
          user={currentUserQuery.data}
        >
          <AdminSidebar user={currentUserQuery.data} />
          <SidebarInset className="min-h-0 min-w-0">{children}</SidebarInset>
        </ProjectProvider>
      </Suspense>
    </SidebarProvider>
  );
}
