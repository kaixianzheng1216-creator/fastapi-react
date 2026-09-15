"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { AppHeader } from "@/components/layout/app-header";
import { LoadError } from "@/components/common/load-error";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { knowledgeBasesReadKnowledgeBase } from "@/lib/client";
import { KnowledgeDocuments } from "@/app/admin/knowledge-bases/_components/documents";
import { KnowledgeSearch } from "@/app/admin/knowledge-bases/_components/search";

type KnowledgeBaseDetailProps = { knowledgeBaseId: string };

export function KnowledgeBaseDetail({
  knowledgeBaseId,
}: KnowledgeBaseDetailProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

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

  function changeView(view: string): void {
    const parameters = new URLSearchParams(searchParams);

    if (view === "search") {
      parameters.set("view", "search");
    } else {
      parameters.delete("view");
    }

    const path = `/admin/knowledge-bases/${knowledgeBaseId}`;
    const query = parameters.toString();

    router.replace(query ? `${path}?${query}` : path, { scroll: false });
  }

  return (
    <>
      <AppHeader
        title={knowledgeBaseQuery.data?.name ?? "知识库详情"}
        left={
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href="/admin/knowledge-bases" aria-label="返回知识库列表">
              <ArrowLeftIcon aria-hidden="true" />
            </Link>
          </Button>
        }
      />

      <div
        className={`flex min-h-0 flex-1 flex-col p-4 md:p-6 ${activeView === "search" ? "overflow-hidden" : "overflow-y-auto md:overflow-hidden"}`}
      >
        {knowledgeBaseQuery.isError &&
          knowledgeBaseQuery.data === undefined ? (
          <LoadError
            title="知识库加载失败"
            isRetrying={knowledgeBaseQuery.isFetching}
            onRetry={() => void knowledgeBaseQuery.refetch()}
            className="mx-auto min-h-full max-w-6xl"
          />
        ) : (
          <Tabs
            value={activeView}
            className={`mx-auto w-full max-w-6xl gap-6 ${activeView === "search" ? "h-full min-h-0" : "min-h-full md:h-full md:min-h-0"}`}
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
                knowledgeBaseId={knowledgeBaseId}
              />
            </TabsContent>

            <TabsContent
              value="search"
              className="flex min-h-0 flex-col gap-6"
            >
              <KnowledgeSearch knowledgeBaseId={knowledgeBaseId} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </>
  );
}
