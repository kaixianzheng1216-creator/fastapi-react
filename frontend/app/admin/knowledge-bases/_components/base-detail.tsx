"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { AppHeader } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { knowledgeBasesReadKnowledgeBase } from "@/lib/client";
import { cn } from "@/lib/utils";
import { KnowledgeDocuments } from "@/app/admin/knowledge-bases/_components/documents";
import { KnowledgeSearch } from "@/app/admin/knowledge-bases/_components/search";

type KnowledgeBaseDetailProps = { knowledgeBaseId: string };

export function KnowledgeBaseDetail({
  knowledgeBaseId,
}: KnowledgeBaseDetailProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const knowledgeBaseQuery = useQuery({
    queryKey: ["knowledge-base", knowledgeBaseId],
    queryFn: async ({ signal }) => {
      const { data } = await knowledgeBasesReadKnowledgeBase({
        path: { knowledge_base_id: knowledgeBaseId },
        signal,
        throwOnError: true,
      });

      return data;
    },
    retry: false,
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

      <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
        {knowledgeBaseQuery.isPending ? (
          <Skeleton
            role="status"
            aria-label="正在加载知识库详情"
            className="mx-auto h-64 max-w-6xl"
          />
        ) : !knowledgeBaseQuery.data ? (
          <Empty className="mx-auto min-h-full max-w-6xl">
            <EmptyHeader>
              <EmptyTitle>暂无可显示内容</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : null}

        {
          (knowledgeBaseQuery.isPending || knowledgeBaseQuery.data) && (
            <Tabs
              value={activeView}
              className={cn(
                "mx-auto min-h-full max-w-6xl gap-6",
                knowledgeBaseQuery.isPending && "hidden",
              )}
              onValueChange={changeView}
            >
              <TabsList>
                <TabsTrigger value="documents">文档</TabsTrigger>
                <TabsTrigger value="search">搜索</TabsTrigger>
              </TabsList>

              <TabsContent
                value="documents"
                forceMount
                className="data-[state=inactive]:hidden"
              >
                <KnowledgeDocuments
                  key={knowledgeBaseId}
                  knowledgeBaseId={knowledgeBaseId}
                />
              </TabsContent>

              <TabsContent value="search" className="flex flex-col gap-6">
                <KnowledgeSearch knowledgeBaseId={knowledgeBaseId} />
              </TabsContent>
            </Tabs>
          )}
      </div>
    </>
  );
}
