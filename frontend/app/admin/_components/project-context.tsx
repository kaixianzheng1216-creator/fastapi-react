"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

import { projectsReadProject, type ProjectPublic, type UserPublic } from "@/lib/client";
import { getQueryViewState } from "@/lib/query-view-state";

type ProjectState = {
  project?: ProjectPublic;
  isLoading: boolean;
  isError: boolean;
  isRetrying: boolean;
  retry: () => void;
};

const ProjectContext = createContext<ProjectState | null>(null);

export function useProjectState() {
  const state = useContext(ProjectContext);
  if (!state) throw new Error("ProjectProvider is required");
  return state;
}

export const useProject = () => useProjectState().project;
export const useProjectLoading = () => useProjectState().isLoading;

export function ProjectProvider({
  user,
  children,
}: {
  user: UserPublic;
  children: ReactNode;
}) {
  const { projectId: routeProjectId } = useParams<{ projectId?: string }>();
  const storageKey = `last-project:${user.id}`;
  const [recentProjectId, setRecentProjectId] = useState<string | null>();

  useEffect(() => {
    setRecentProjectId(localStorage.getItem(storageKey));
  }, [storageKey]);

  const projectId = routeProjectId ?? recentProjectId;

  const project = useQuery({
    queryKey: ["project", projectId],
    enabled: !!projectId,
    meta: { handlesInitialError: true },
    queryFn: async ({ signal }) =>
      (
        await projectsReadProject({
          path: { project_id: projectId! },
          signal,
          throwOnError: true,
        })
      ).data,
  });

  useEffect(() => {
    if (routeProjectId && project.data?.id === routeProjectId) {
      localStorage.setItem(storageKey, routeProjectId);
      setRecentProjectId(routeProjectId);
    }
  }, [routeProjectId, project.data?.id, storageKey]);

  const projectState = getQueryViewState(project);

  return (
    <ProjectContext
      value={{
        project: project.data,
        isLoading:
          (!routeProjectId && recentProjectId === undefined) ||
          (!!projectId && project.isPending),
        isError: projectState === "error",
        isRetrying: project.isFetching,
        retry: () => void project.refetch(),
      }}
    >
      {children}
    </ProjectContext>
  );
}
