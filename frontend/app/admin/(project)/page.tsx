"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { projectHref, projectMembersHref } from "@/lib/project-routes";
import { useProjectState } from "@/app/admin/_components/project-context";
import { LoadError } from "@/components/common/load-error";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { useCurrentUserQuery } from "@/hooks/use-current-user";
import { projectsReadProjects } from "@/lib/client";

export default function AdminPage() {
  const router = useRouter();
  const isSuperuser = useCurrentUserQuery().data?.is_superuser;
  const { project: recentProject, isLoading: isProjectLoading } =
    useProjectState();
  const projects = useQuery({
    queryKey: ["projects", "landing"],
    enabled: !isProjectLoading && !recentProject,
    meta: { handlesInitialError: true },
    queryFn: async ({ signal }) =>
      (
        await projectsReadProjects({
          query: { limit: 1 },
          signal,
          throwOnError: true,
        })
      ).data,
  });
  const project = recentProject ?? projects.data?.data[0];

  useEffect(() => {
    if (project) {
      const href =
        isSuperuser || project.role === "admin"
          ? projectMembersHref(project.id)
          : projectHref(project.id);

      router.replace(href);
    }
  }, [project, isSuperuser, router]);

  if (projects.isError) {
    return (
      <LoadError
        title="项目加载失败"
        isRetrying={projects.isFetching}
        onRetry={() => void projects.refetch()}
      />
    );
  }

  if (projects.data && !project) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>尚未加入项目</EmptyTitle>
          <EmptyDescription>
            {isSuperuser
              ? "先创建项目，再添加知识库和成员。"
              : "请联系管理员将你加入项目。"}
          </EmptyDescription>
        </EmptyHeader>
        {isSuperuser && (
          <EmptyContent>
            <Button asChild>
              <Link href="/admin/manage">管理项目</Link>
            </Button>
          </EmptyContent>
        )}
      </Empty>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center">
      <Spinner aria-label="正在进入项目" />
    </div>
  );
}
