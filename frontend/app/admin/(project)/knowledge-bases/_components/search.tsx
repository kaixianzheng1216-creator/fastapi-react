"use client";

import { useQuery } from "@tanstack/react-query";
import { SearchIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoadError } from "@/components/common/load-error";
import { ContentSkeleton } from "./content-skeleton";
import { getQueryViewState } from "@/lib/query-view-state";
import { MarkdownContent } from "@/components/common/markdown-content";
import { SearchToolbar } from "@/components/common/search-toolbar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { knowledgeBasesSearchKnowledgeBase } from "@/lib/client";
import { KNOWLEDGE_SEARCH_QUERY_KEY } from "@/app/admin/(project)/knowledge-bases/_lib/directory";
import { getKnowledgeSearchHref } from "@/app/admin/(project)/knowledge-bases/_lib/navigation";

const similarityFormatter = new Intl.NumberFormat("zh-CN", {
  style: "percent",
  maximumFractionDigits: 0,
});

export function KnowledgeSearch({
  projectId,
  knowledgeBaseId,
}: {
  projectId: string;
  knowledgeBaseId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get("q")?.trim() ?? "";

  const knowledgeSearchQuery = useQuery({
    meta: { handlesInitialError: true },
    queryKey: [...KNOWLEDGE_SEARCH_QUERY_KEY, knowledgeBaseId, searchQuery],
    queryFn: async ({ signal }) => {
      const { data } = await knowledgeBasesSearchKnowledgeBase({
        path: { knowledge_base_id: knowledgeBaseId },
        body: { query: searchQuery },
        signal,
        throwOnError: true,
      });

      return data;
    },
    enabled: Boolean(searchQuery),
  });

  const searchResults = knowledgeSearchQuery.data?.data;
  const viewState = getQueryViewState(knowledgeSearchQuery);

  function submitSearch(query: string): void {
    if (knowledgeSearchQuery.isFetching) return;

    if (query === searchQuery) {
      if (query) void knowledgeSearchQuery.refetch();
      return;
    }

    router.push(
      getKnowledgeSearchHref(projectId, knowledgeBaseId, query, searchParams),
      { scroll: false },
    );
  }

  return (
    <>
      <SearchToolbar
        label="搜索知识库"
        placeholder="输入关键词或问题…"
        className="shrink-0"
        onSearch={submitSearch}
        value={searchQuery}
        searchOnChange={false}
        maxLength={1000}
        isPending={knowledgeSearchQuery.isFetching}
      />

      {searchQuery &&
        searchResults !== undefined &&
        searchResults.length > 0 && (
          <h2
            className="shrink-0 text-sm text-muted-foreground"
            aria-live="polite"
          >
            以下内容与你的搜索最相关
          </h2>
        )}
      <div
        key={searchQuery}
        className="flex min-w-0 flex-col gap-4"
        aria-busy={knowledgeSearchQuery.isFetching}
      >
        {searchQuery && viewState === "loading" && <ContentSkeleton />}
        {searchQuery && viewState === "error" && (
          <LoadError
            title="搜索失败"
            isRetrying={knowledgeSearchQuery.isFetching}
            onRetry={() => void knowledgeSearchQuery.refetch()}
          />
        )}

        {(!searchQuery ||
          (viewState === "ready" && searchResults?.length === 0)) && (
          <Empty className="flex-none">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SearchIcon aria-hidden="true" />
              </EmptyMedia>
              {searchQuery && <EmptyTitle>未找到相关内容</EmptyTitle>}
              <EmptyDescription>
                {searchQuery
                  ? "试试其他关键词，或换一种方式描述问题。"
                  : "输入关键词或问题，按 Enter 搜索相关内容。"}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
        {searchResults?.map((result) => (
          <Card
            key={`${result.document_id}-${result.chunk_index}`}
            className="shrink-0 wrap-anywhere"
          >
            <CardHeader>
              <CardTitle>
                {result.knowledge_base_name} · {result.filename}
              </CardTitle>
              <CardDescription className="flex flex-wrap gap-x-4 gap-y-1">
                <span>
                  页码：
                  {result.page_numbers.length > 0
                    ? `第 ${result.page_numbers.join("、")} 页`
                    : "未标注"}
                </span>
                <span>
                  章节：
                  {result.section_path.length > 0
                    ? result.section_path.join(" / ")
                    : "未标注"}
                </span>
              </CardDescription>
              <CardAction>
                <Badge variant="secondary" className="tabular-nums">
                  相关度 {similarityFormatter.format(result.score)}
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {result.image_urls.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {result.image_urls.map((imageUrl, imageIndex) => (
                    <img
                      key={imageUrl}
                      src={imageUrl}
                      alt={`搜索结果关联图片 ${imageIndex + 1}`}
                      className="aspect-video max-h-96 w-full object-contain"
                      loading="lazy"
                      decoding="async"
                    />
                  ))}
                </div>
              ) : null}
              <MarkdownContent className="max-w-none">
                {result.content}
              </MarkdownContent>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
