"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { AdminSidebar } from "@/app/admin/_components/admin-sidebar";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { useCurrentUserQuery } from "@/hooks/use-current-user";

function AdminShellState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <main className="flex min-h-svh">
      <Empty role="status">
        <EmptyHeader>
          <EmptyTitle>{title}</EmptyTitle>
          {description && <EmptyDescription>{description}</EmptyDescription>}
        </EmptyHeader>
        <EmptyContent>
          <Button asChild variant="outline" size="sm">
            <Link href="/">返回聊天</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </main>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const { data: user, isPending } = useCurrentUserQuery();

  if (isPending) {
    return (
      <div className="flex h-svh items-center justify-center">
        <Spinner aria-label="正在加载页面" />
      </div>
    );
  }

  if (!user) {
    return <AdminShellState title="暂无可显示内容" />;
  }

  if (!user.is_superuser) {
    return (
      <AdminShellState
        title="无权访问管理后台"
        description="当前账户没有管理员权限，请联系管理员获取权限。"
      />
    );
  }

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <AdminSidebar user={user} />
      <SidebarInset className="min-h-0">{children}</SidebarInset>
    </SidebarProvider>
  );
}
