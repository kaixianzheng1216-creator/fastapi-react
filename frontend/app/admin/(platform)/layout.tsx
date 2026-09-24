"use client";

import type { ReactNode } from "react";

import { AppHeader } from "@/components/layout/app-header";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { useCurrentUserQuery } from "@/hooks/use-current-user";

export default function PlatformLayout({ children }: { children: ReactNode }) {
  if (useCurrentUserQuery().data?.is_superuser) return children;

  return (
    <>
      <AppHeader title="平台管理" />
      <Empty>
        <EmptyHeader>
          <EmptyTitle>无权访问此页面</EmptyTitle>
          <EmptyDescription>请使用左侧菜单进入有权限的功能。</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </>
  );
}
