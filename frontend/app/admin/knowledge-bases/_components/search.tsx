"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertCircleIcon, SearchIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent } from "react";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { getApiErrorMessage } from "@/lib/api-error";
import { knowledgeBasesSearchKnowledgeBase } from "@/lib/client";
import { KNOWLEDGE_SEARCH_QUERY_KEY } from "@/app/admin/knowledge-bases/_lib/directory";
import { getKnowledgeSearchHref } from "@/app/admin/knowledge-bases/_lib/navigation";

const similarityFormatter = new Intl.NumberFormat("zh-CN", {
  style: "percent",
  maximumFractionDigits: 0,
});

export function KnowledgeSearch({
  knowledgeBaseId,
}: {
  knowledgeBaseId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get("q")?.trim() ?? "";

  const searchKnowledge = useQuery({
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
    placeholderData: keepPreviousData,
    retry: false,
  });

  const searchResults = searchKnowledge.data?.data;

  function submitSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const query = String(formData.get("query") ?? "").trim();

    if (query) {
      if (query === searchQuery) {
        void searchKnowledge.refetch();
      } else {
        router.push(
          getKnowledgeSearchHref(knowledgeBaseId, query, searchParams),
          {
            scroll: false,
          },
        );
      }
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>搜索知识库</CardTitle>
          <CardDescription>
            输入问题，查看当前知识库中最相关的内容片段。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submitSearch}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="knowledge-search-query">问题</FieldLabel>
                <Input
                  key={searchQuery}
                  id="knowledge-search-query"
                  name="query"
                  defaultValue={searchQuery}
                  autoComplete="off"
                  placeholder="输入想了解的问题…"
                  maxLength={1000}
                  required
                />
              </Field>
              <Button
                type="submit"
                className="self-end"
                disabled={searchKnowledge.isFetching}
              >
                {searchKnowledge.isFetching ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <SearchIcon data-icon="inline-start" aria-hidden="true" />
                )}
                搜索
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      {searchKnowledge.error ? (
        <Alert variant="destructive">
          <AlertCircleIcon aria-hidden="true" />
          <AlertTitle>
            {getApiErrorMessage(searchKnowledge.error, "搜索失败")}
          </AlertTitle>
        </Alert>
      ) : null}

      {searchResults?.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>未找到相关内容</EmptyTitle>
            <EmptyDescription>
              可以换个问法，或确认相关文档已处理完成。
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {searchResults?.map((result) => (
        <Card
          key={`${result.document_id}-${result.chunk_index}`}
          className="wrap-anywhere"
        >
          <CardHeader>
            <CardTitle>
              {result.knowledge_base_name} · {result.filename}
            </CardTitle>
            <CardDescription className="flex flex-wrap gap-x-4 gap-y-1">
              <span>
                章节：
                {result.section_path.length > 0
                  ? result.section_path.join(" / ")
                  : "未标注"}
              </span>
              <span>
                页码：
                {result.page_numbers.length > 0
                  ? `第 ${result.page_numbers.join("、")} 页`
                  : "未标注"}
              </span>
            </CardDescription>
            <CardAction>
              <Badge variant="secondary" className="tabular-nums">
                相似度 {similarityFormatter.format(result.score)}
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
                    className="max-h-96 w-full object-contain"
                    loading="lazy"
                    decoding="async"
                  />
                ))}
              </div>
            ) : null}
            <p className="whitespace-pre-wrap">{result.content}</p>
          </CardContent>
        </Card>
      ))}
    </>
  );
}
