"use client";

import { useProject } from "@/app/admin/_components/project-context";
import { projectHref } from "@/lib/project-routes";

import { usePaginationScrollReset } from "@/hooks/use-pagination-scroll-reset";
import { useEffect } from "react";
import { parsePage } from "@/lib/pagination";
import { cn } from "@/lib/utils";

import { useQuery } from "@tanstack/react-query";
import { redirect, useRouter, useSearchParams } from "next/navigation";

import { AppHeader } from "@/components/layout/app-header";
import { getQueryViewState } from "@/lib/query-view-state";
import { LoadError } from "@/components/common/load-error";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { knowledgeBasesReadKnowledgeBase } from "@/lib/client";
import { KnowledgeDocuments } from "@/app/admin/(project)/knowledge-bases/_components/documents";
import { KnowledgeSearch } from "@/app/admin/(project)/knowledge-bases/_components/search";

type KnowledgeBaseDetailProps = { knowledgeBaseId: string };

export function KnowledgeBaseDetail({
  knowledgeBaseId,
}: KnowledgeBaseDetailProps) {
  const router = useRouter();
  const project = useProject()!;
  const searchParams = useSearchParams();
  const scrollRef = usePaginationScrollReset<HTMLDivElement>(
    parsePage(searchParams.get("page")),
  );

  const knowledgeBaseQuery = useQuery({
    meta: { handlesInitialError: true },
    queryKey: ["knowledge-base", knowledgeBaseId],
    queryFn: async ({ signal }) => {
      const { data } = await knowledgeBasesReadKnowledgeBase({
        path: { knowledge_base_id: knowledgeBaseId },
        signal,
        throwOnError: true,
      });

      return data;
    },
  });

  const activeView =
    searchParams.get("view") === "search" ? "search" : "documents";
  const searchQuery = searchParams.get("q");

  useEffect(() => {
    if (activeView === "search") scrollRef.current?.scrollTo({ top: 0 });
  }, [activeView, searchQuery, scrollRef]);

  function changeView(view: string): void {
    const parameters = new URLSearchParams(searchParams);

    if (view === "search") {
      parameters.set("view", "search");
    } else {
      parameters.delete("view");
    }

    const path = `${projectHref(project.id)}/${knowledgeBaseId}`;
    const query = parameters.toString();

    router.replace(query ? `${path}?${query}` : path, { scroll: false });
  }

  if (
    knowledgeBaseQuery.data?.project_id &&
    knowledgeBaseQuery.data.project_id !== project.id
  ) {
    redirect(
      `${projectHref(knowledgeBaseQuery.data.project_id)}/${knowledgeBaseId}`,
    );
  }

  return (
    <>
      <AppHeader
        title={knowledgeBaseQuery.data?.name ?? "知识库详情"}
        breadcrumbs={[{ label: "知识库", href: projectHref(project.id) }]}
      />

      <div
        ref={scrollRef}
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-y-auto p-4 md:p-6",
          activeView !== "search" && "md:overflow-hidden",
        )}
      >
        {getQueryViewState(knowledgeBaseQuery) === "error" ? (
          <LoadError
            title="知识库加载失败"
            isRetrying={knowledgeBaseQuery.isFetching}
            onRetry={() => void knowledgeBaseQuery.refetch()}
            className="mx-auto min-h-full max-w-6xl"
          />
        ) : (
          <Tabs
            value={activeView}
            className={cn(
              "mx-auto min-h-full w-full max-w-6xl gap-6",
              activeView === "search" ? "shrink-0" : "md:h-full md:min-h-0",
            )}
            onValueChange={changeView}
          >
            <TabsList className="shrink-0">
              <TabsTrigger value="documents">文档</TabsTrigger>
              <TabsTrigger value="search">搜索</TabsTrigger>
            </TabsList>

            <TabsContent
              value="documents"
              forceMount
              className="flex flex-col data-[state=inactive]:hidden md:min-h-0"
            >
              <KnowledgeDocuments
                key={knowledgeBaseId}
                projectId={project.id}
                knowledgeBaseId={knowledgeBaseId}
              />
            </TabsContent>

            <TabsContent value="search" className="flex min-h-0 flex-col gap-4">
              <KnowledgeSearch
                projectId={project.id}
                knowledgeBaseId={knowledgeBaseId}
              />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </>
  );
}
