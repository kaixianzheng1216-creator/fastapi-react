"use client";

import {
  type InfiniteData,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { ArrowRightIcon, ExternalLinkIcon } from "lucide-react";
import { getApiErrorMessage } from "@/lib/api-error";
import { Button } from "@/components/ui/button";
import { FormDialogFooter } from "@/components/common/form-dialog-footer";
import { LoadError } from "@/components/common/load-error";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import {
  knowledgeBasesSearchWebSources,
  type WebSearchPage,
  type WebSearchRequest,
} from "@/lib/client";

export type SearchSource = NonNullable<WebSearchRequest["source"]>;

type SearchPageParam = Pick<WebSearchRequest, "page" | "search_id">;

const searchSources: Record<SearchSource, string> = {
  web: "全网",
  xiaohongshu: "小红书",
  douyin: "抖音",
};

const resultKey = (url: string, source: SearchSource) => {
  if (source === "web") return url;

  const parsed = new URL(url);
  return `${parsed.origin}${parsed.pathname}`;
};

export function DocumentSearch({
  knowledgeBaseId,
  mode,
  importing,
  onSearch,
  onImport,
}: {
  knowledgeBaseId: string;
  mode: "input" | "results" | "hidden";
  importing: boolean;
  onSearch: () => void;
  onImport: (
    urls: string[],
    source: SearchSource,
  ) => Promise<{ url: string; error: string }[]>;
}) {
  const inputId = useId();
  const queryClient = useQueryClient();

  const resultsRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const requestController = useRef(new AbortController());

  const [query, setQuery] = useState("");
  const [source, setSource] = useState<SearchSource>("web");
  const [submittedQuery, setSubmittedQuery] = useState("");

  const [selectedUrls, setSelectedUrls] = useState<string[]>([]);
  const [importedKeys, setImportedKeys] = useState<Set<string>>(() => new Set());

  const showResults = mode === "results";
  const searchCacheKey = ["knowledge-source-search", knowledgeBaseId, inputId];

  const searchQuery = useInfiniteQuery({
    queryKey: [...searchCacheKey, source, submittedQuery],
    enabled: showResults && submittedQuery.length > 0,
    staleTime: Infinity,
    gcTime: Infinity,
    meta: { handlesError: true },
    initialPageParam: { page: 1 } as SearchPageParam,
    queryFn: async ({ pageParam }) => {
      const { data } = await knowledgeBasesSearchWebSources({
        path: { knowledge_base_id: knowledgeBaseId },
        body: { query: submittedQuery, source, ...pageParam },
        signal: requestController.current.signal,
        throwOnError: true,
      });

      return data;
    },
    getNextPageParam: (lastPage): SearchPageParam | undefined =>
      lastPage.next_page == null
        ? undefined
        : { page: lastPage.next_page, search_id: lastPage.search_id },
  });

  const { hasNextPage, isFetching, isError, fetchNextPage } = searchQuery;
  const isSearching = searchQuery.isFetching && !searchQuery.isFetchingNextPage;

  const pages = searchQuery.data?.pages ?? [];
  const seenKeys = new Set<string>();
  const results: WebSearchPage["items"] = [];
  let lastPageHasNewResults = false;

  for (const page of pages) {
    lastPageHasNewResults = false;

    for (const item of page.items) {
      const key = resultKey(item.url, source);

      if (seenKeys.has(key)) continue;

      seenKeys.add(key);
      lastPageHasNewResults = true;

      if (!importedKeys.has(key)) {
        results.push(item);
      }
    }
  }

  const pauseAutoLoad =
    source === "xiaohongshu" &&
    pages.length > 0 &&
    !lastPageHasNewResults;

  function prepareSearch(keyword: string) {
    setQuery(keyword);
    setSubmittedQuery(keyword);
    setSelectedUrls([]);
    resultsRef.current?.scrollTo({ top: 0 });
  }

  function changeSource(nextSource: SearchSource) {
    setSource(nextSource);

    if (showResults) {
      prepareSearch(query.trim());
    }
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const keyword = query.trim();
    const key = [...searchCacheKey, source, keyword];

    if (showResults) {
      queryClient.setQueryData<InfiniteData<WebSearchPage>>(
        key,
        (data) =>
          data && {
            pages: data.pages.slice(0, 1),
            pageParams: data.pageParams.slice(0, 1),
          },
      );
      void queryClient.invalidateQueries({ queryKey: key, exact: true });
    }

    prepareSearch(keyword);
    onSearch();
  }

  async function importSelected(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const failures = await onImport(selectedUrls, source);

    if (!failures.length) return;

    const failedUrls = failures.map(({ url }) => url);
    const failedUrlSet = new Set(failedUrls);

    setImportedKeys((keys) => {
      const imported = new Set(keys);

      for (const url of selectedUrls) {
        if (!failedUrlSet.has(url)) {
          imported.add(resultKey(url, source));
        }
      }

      return imported;
    });

    setSelectedUrls(failedUrls);
  }

  useEffect(() => {
    const controller = new AbortController();
    requestController.current = controller;

    return () => {
      controller.abort();
      queryClient.removeQueries({
        queryKey: ["knowledge-source-search", knowledgeBaseId, inputId],
      });
    };
  }, [queryClient, knowledgeBaseId, inputId]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (
      !showResults ||
      !target ||
      !hasNextPage ||
      pauseAutoLoad ||
      isFetching ||
      isError ||
      importing
    )
      return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void fetchNextPage({ cancelRefetch: false });
      },
      { root: resultsRef.current, rootMargin: "0px 0px 150px 0px" },
    );

    observer.observe(target);

    return () => observer.disconnect();
  }, [
    showResults,
    hasNextPage,
    pauseAutoLoad,
    isFetching,
    isError,
    fetchNextPage,
    importing,
  ]);

  return (
    <div className={mode === "hidden" ? "hidden" : "contents"}>
      <form className="shrink-0" onSubmit={submitSearch}>
        <FieldGroup>
          <Field>
            <FieldLabel className="sr-only" htmlFor={`${inputId}-search`}>
              在网络中搜索资料
            </FieldLabel>
            <InputGroup>
              <InputGroupTextarea
                id={`${inputId}-search`}
                placeholder="在网络中搜索资料……"
                value={query}
                maxLength={1000}
                disabled={importing}
                onChange={(event) => setQuery(event.target.value)}
              />
              <InputGroupAddon align="block-end" className="justify-between">
                <ToggleGroup
                  type="single"
                  size="sm"
                  value={source}
                  disabled={importing}
                  aria-label="搜索范围"
                  onValueChange={(value) => {
                    if (!value) return;
                    changeSource(value as SearchSource);
                  }}
                >
                  {Object.entries(searchSources).map(([value, label]) => (
                    <ToggleGroupItem key={value} value={value}>
                      {label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <InputGroupButton
                  type="submit"
                  size="icon-sm"
                  aria-label="搜索网络资料"
                  disabled={
                    importing ||
                    !query.trim() ||
                    (showResults &&
                      searchQuery.isFetching &&
                      query.trim() === submittedQuery)
                  }
                >
                  <ArrowRightIcon aria-hidden="true" />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </Field>
        </FieldGroup>
      </form>
      {showResults && (
        <form
          className="flex min-h-0 flex-col gap-4"
          onSubmit={importSelected}
        >
          <ScrollArea
            viewportRef={resultsRef}
            viewportClassName="relative scroll-content-y"
            className="h-[40svh] min-h-0"
          >
            {searchQuery.isFetching && searchQuery.data === undefined ? (
              <div role="status" className="absolute inset-0 overflow-hidden">
                <span className="sr-only">正在搜索…</span>
                <FieldGroup aria-hidden="true">
                  {[0, 1, 2, 3, 4].map((index) => (
                    <Field key={index} orientation="horizontal">
                      <Skeleton className="size-4 shrink-0" />
                      <FieldContent>
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-4 w-1/3" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-2/3" />
                      </FieldContent>
                    </Field>
                  ))}
                </FieldGroup>
              </div>
            ) : searchQuery.isError && !searchQuery.data ? (
              <LoadError
                title={getApiErrorMessage(searchQuery.error, "网络搜索失败")}
                onRetry={() => void searchQuery.refetch()}
              />
            ) : results.length ? (
              <FieldGroup>
                {results.map((result, index) => (
                  <Field key={result.url} orientation="horizontal">
                    <Checkbox
                      id={`${inputId}-result-${index}`}
                      aria-label={`选择 ${result.title}`}
                      checked={selectedUrls.includes(result.url)}
                      disabled={importing || isSearching}
                      onCheckedChange={(checked) =>
                        setSelectedUrls((urls) =>
                          checked === true
                            ? [...urls, result.url]
                            : urls.filter((url) => url !== result.url),
                        )
                      }
                    />
                    <FieldContent className="min-w-0 wrap-anywhere">
                      <FieldLabel htmlFor={`${inputId}-result-${index}`}>
                        <span className="line-clamp-2">{result.title}</span>
                      </FieldLabel>
                      <FieldDescription>
                        {source === "web" ? "网络" : searchSources[source]}
                        {` · ${result.author || new URL(result.url).hostname}`}
                        {result.published_at != null &&
                          ` · ${new Date(result.published_at * 1000).toLocaleDateString("zh-CN")}`}
                      </FieldDescription>
                      <FieldDescription className="line-clamp-2">
                        {result.description}
                      </FieldDescription>
                      <FieldDescription>
                        {[
                          ["赞", result.likes],
                          ["评论", result.comments],
                          ["收藏", result.collects],
                        ]
                          .filter(([, count]) => count != null)
                          .map(
                            ([label, count]) =>
                              `${label} ${Number(count).toLocaleString("zh-CN")}`,
                          )
                          .join(" · ")}
                      </FieldDescription>
                      <FieldDescription>
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1"
                        >
                          查看原文
                          <ExternalLinkIcon
                            className="size-4"
                            aria-hidden="true"
                          />
                        </a>
                      </FieldDescription>
                    </FieldContent>
                    {result.cover_url && (
                      <img
                        src={result.cover_url}
                        alt=""
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="size-20 shrink-0 rounded-md object-cover"
                      />
                    )}
                  </Field>
                ))}
              </FieldGroup>
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>
                    {!submittedQuery
                      ? "输入关键词开始搜索"
                      : "未找到相关内容，请换一个关键词"}
                  </EmptyTitle>
                </EmptyHeader>
              </Empty>
            )}
            {searchQuery.data && (
              <div
                ref={loadMoreRef}
                className="flex min-h-12 items-center justify-center"
              >
                {searchQuery.isError ? (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={importing || searchQuery.isFetching}
                    onClick={() =>
                      searchQuery.isFetchNextPageError
                        ? void fetchNextPage({ cancelRefetch: false })
                        : void searchQuery.refetch()
                    }
                  >
                    {getApiErrorMessage(searchQuery.error, "加载失败")} · 点击重试
                  </Button>
                ) : searchQuery.isFetchingNextPage ? (
                  <FieldDescription
                    role="status"
                    className="flex items-center gap-2"
                  >
                    <Spinner aria-hidden="true" />
                    正在加载更多…
                  </FieldDescription>
                ) : hasNextPage && pauseAutoLoad ? (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={importing || searchQuery.isFetching}
                    onClick={() => void fetchNextPage({ cancelRefetch: false })}
                  >
                    暂无新增结果，继续加载
                  </Button>
                ) : !hasNextPage && results.length > 0 ? (
                  <FieldDescription>没有更多结果</FieldDescription>
                ) : null}
              </div>
            )}
          </ScrollArea>
          <FormDialogFooter
            isPending={importing}
            disabled={isSearching || !selectedUrls.length}
            submitLabel="添加所选"
          />
        </form>
      )}
    </div>
  );
}
