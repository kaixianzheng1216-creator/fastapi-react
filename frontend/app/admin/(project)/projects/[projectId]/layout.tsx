"use client";

import { Fragment, type ReactNode } from "react";

import { useProjectState } from "@/app/admin/_components/project-context";
import { LoadError } from "@/components/common/load-error";
import { AppHeader } from "@/components/layout/app-header";
import { Spinner } from "@/components/ui/spinner";

export default function ProjectLayout({ children }: { children: ReactNode }) {
  const { project, isLoading, isError, isRetrying, retry } = useProjectState();

  if (isError || isLoading || !project) {
    return (
      <>
        <AppHeader title="项目" />
        {isError ? (
          <LoadError
            title="项目加载失败，请重试"
            onRetry={retry}
            isRetrying={isRetrying}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <Spinner aria-label="加载项目" />
          </div>
        )}
      </>
    );
  }

  return <Fragment key={project.id}>{children}</Fragment>;
}
