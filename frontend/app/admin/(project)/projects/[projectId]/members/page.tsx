"use client";

import { useProject } from "@/app/admin/_components/project-context";
import { AppHeader } from "@/components/layout/app-header";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { MemberManager } from "./_components/member-manager";

export default function MembersPage() {
  const project = useProject();
  if (project?.role === "admin") return <MemberManager />;

  return (
    <>
      <AppHeader title="项目成员" />
      <Empty>
        <EmptyHeader>
          <EmptyTitle>无权访问此页面</EmptyTitle>
          <EmptyDescription>只有项目管理员可以管理成员。</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </>
  );
}
