"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  createColumnHelper,
  metaHelper,
  rowPaginationFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { AlertCircleIcon, TrophyIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { AppHeader } from "@/components/layout/app-header";
import { PageOutOfRange } from "@/components/shared/page-out-of-range";
import { PagePagination } from "@/components/shared/page-pagination";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  type BilibiliRankingCategoryCode,
  type BilibiliRankingItemPublic,
  contentOperationsReadBilibiliRanking,
} from "@/lib/client";
import { getPaginationHref, parsePage } from "@/lib/pagination";

const PAGE_SIZE = 20;
const BILIBILI_QUERY_KEY = ["content-operations-bilibili-ranking"] as const;
const EMPTY_ITEMS: BilibiliRankingItemPublic[] = [];

const PLATFORMS = [
  { code: "douyin", name: "抖音" },
  { code: "kuaishou", name: "快手" },
  { code: "xiaohongshu", name: "小红书" },
  { code: "bilibili", name: "B 站" },
] as const;

const BILIBILI_CATEGORY_CODES = {
  all: true,
  animation: true,
  game: true,
  kichiku: true,
  music: true,
  dance: true,
  cinephile: true,
  entertainment: true,
  knowledge: true,
  tech: true,
  food: true,
  car: true,
  fashion: true,
  sports: true,
} satisfies Record<BilibiliRankingCategoryCode, true>;

type PlatformCode = (typeof PLATFORMS)[number]["code"];

const countFormatter = new Intl.NumberFormat("zh-CN", {
  notation: "compact",
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "2-digit",
  day: "2-digit",
});

const capturedAtFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const rankingTableFeatures = tableFeatures({
  rowPaginationFeature,
  columnMeta: metaHelper<{ className?: string }>(),
});

const rankingColumnHelper = createColumnHelper<
  typeof rankingTableFeatures,
  BilibiliRankingItemPublic
>();

const rankingColumns = rankingColumnHelper.columns([
  rankingColumnHelper.accessor("rank", {
    header: "排名",
    cell: ({ row }) => row.original.rank,
    meta: { className: "w-14" },
  }),
  rankingColumnHelper.accessor("title", {
    header: "视频",
    cell: ({ row }) => {
      const video = row.original;

      return (
        <div className="flex min-w-0 items-center gap-3">
          <img
            className="aspect-video shrink-0 rounded-md object-cover"
            src={`${video.cover_url}@412w_232h_1c_!web-popular.avif`}
            alt=""
            width={128}
            height={72}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
          />
          <div className="flex min-w-0 flex-col gap-1">
            <Link
              className="whitespace-normal break-words font-medium hover:underline"
              href={`https://www.bilibili.com/video/${video.bvid}`}
              target="_blank"
              rel="noreferrer"
            >
              {video.title}
            </Link>
            <span className="text-xs text-muted-foreground">
              {formatDuration(video.duration_seconds)}
            </span>
          </div>
        </div>
      );
    },
    meta: { className: "w-[40%] whitespace-normal" },
  }),
  rankingColumnHelper.accessor("author_name", {
    header: "UP 主",
    meta: { className: "w-36" },
  }),
  rankingColumnHelper.accessor("content_category_name", {
    header: "分区",
    meta: { className: "w-32" },
  }),
  rankingColumnHelper.accessor("view_count", {
    header: "播放",
    cell: ({ row }) => countFormatter.format(row.original.view_count),
    meta: { className: "w-24 text-right" },
  }),
  rankingColumnHelper.accessor("danmaku_count", {
    header: "弹幕",
    cell: ({ row }) => countFormatter.format(row.original.danmaku_count),
    meta: { className: "w-24 text-right" },
  }),
  rankingColumnHelper.accessor("published_at", {
    header: "发布时间",
    cell: ({ row }) =>
      dateFormatter.format(new Date(row.original.published_at)),
    meta: { className: "w-24 text-right" },
  }),
]);

export function PlatformRankings() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const platform = getPlatform(searchParams.get("platform"));
  const category = getCategory(searchParams.get("category"));
  const currentPage = parsePage(searchParams.get("page"));
  const pageIndex = currentPage - 1;

  const rankingQuery = useQuery({
    queryKey: [...BILIBILI_QUERY_KEY, category, pageIndex],
    queryFn: async ({ signal }) => {
      const { data } = await contentOperationsReadBilibiliRanking({
        query: {
          skip: pageIndex * PAGE_SIZE,
          limit: PAGE_SIZE,
          category,
        },
        signal,
        throwOnError: true,
      });

      return data;
    },
    enabled: platform === "bilibili",
    placeholderData: keepPreviousData,
    retry: false,
  });

  const ranking = rankingQuery.data;
  const loadError = rankingQuery.error
    ? getApiErrorMessage(rankingQuery.error, "读取 B 站排行榜失败")
    : "";

  const table = useTable({
    features: rankingTableFeatures,
    data: ranking?.data ?? EMPTY_ITEMS,
    columns: rankingColumns,
    getRowId: (video) => video.bvid,
    manualPagination: true,
    rowCount: ranking?.count ?? 0,
    state: {
      pagination: {
        pageIndex,
        pageSize: PAGE_SIZE,
      },
    },
  });

  const rows = table.getRowModel().rows;
  const pageCount = table.getPageCount();
  const hasSnapshot = ranking?.captured_at != null;
  const pageOutOfRange = (ranking?.count ?? 0) > 0 && rows.length === 0;

  return (
    <>
      <AppHeader
        title="平台榜单"
        left={<SidebarTrigger className="size-9" aria-label="切换管理菜单" />}
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
        <section className="mx-auto flex min-h-full max-w-7xl flex-col gap-6">
          <div className="flex flex-col gap-1">
            <h2 className="font-semibold">内容平台排行榜</h2>
            <p className="text-sm text-muted-foreground">
              查看各内容平台公开排行榜，当前已接入 B 站全站榜。
            </p>
          </div>

          <Tabs
            className="flex-1 gap-6"
            value={platform}
            onValueChange={(value) =>
              router.push(getRankingsHref(getPlatform(value), 1))
            }
          >
            <TabsList
              className="grid w-full grid-cols-4 sm:w-lg"
              variant="line"
            >
              {PLATFORMS.map((item) => (
                <TabsTrigger key={item.code} value={item.code}>
                  {item.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {PLATFORMS.map((item) => (
              <TabsContent
                key={item.code}
                value={item.code}
                className="flex flex-col gap-6"
                aria-busy={item.code === "bilibili" && rankingQuery.isFetching}
              >
                {item.code !== "bilibili" ? (
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <TrophyIcon aria-hidden="true" />
                      </EmptyMedia>
                      <EmptyTitle>{item.name}榜单尚未接入</EmptyTitle>
                      <EmptyDescription>
                        当前平台暂无榜单数据。
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                      <div className="flex flex-col gap-1">
                        <h3 className="font-medium">
                          B 站 · {getCategoryName(ranking, category)}排行榜
                        </h3>
                        <p
                          className="text-sm text-muted-foreground"
                          aria-live="polite"
                        >
                          {ranking?.captured_at
                            ? `采集于 ${capturedAtFormatter.format(new Date(ranking.captured_at))} · 共 ${ranking.count} 条`
                            : "尚未导入榜单数据"}
                        </p>
                      </div>

                      {ranking?.categories.length ? (
                        <Field orientation="horizontal" className="w-auto">
                          <FieldLabel htmlFor="ranking-category">
                            分区
                          </FieldLabel>
                          <Select
                            value={category}
                            onValueChange={(value) =>
                              router.push(
                                getRankingsHref(
                                  "bilibili",
                                  1,
                                  getCategory(value),
                                ),
                              )
                            }
                          >
                            <SelectTrigger
                              id="ranking-category"
                              className="w-36"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {ranking.categories.map((item) => (
                                  <SelectItem key={item.code} value={item.code}>
                                    {item.name}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </Field>
                      ) : null}
                    </div>

                    {rankingQuery.isPending ? (
                      <Skeleton className="h-96" />
                    ) : loadError ? (
                      <Empty>
                        <EmptyHeader>
                          <EmptyMedia variant="icon">
                            <AlertCircleIcon aria-hidden="true" />
                          </EmptyMedia>
                          <EmptyTitle>无法读取 B 站排行榜</EmptyTitle>
                          <EmptyDescription>{loadError}</EmptyDescription>
                        </EmptyHeader>
                        <EmptyContent>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => rankingQuery.refetch()}
                          >
                            重试
                          </Button>
                        </EmptyContent>
                      </Empty>
                    ) : rows.length === 0 ? (
                      pageOutOfRange ? (
                        <PageOutOfRange
                          href={getRankingsHref("bilibili", 1, category)}
                        />
                      ) : (
                        <Empty>
                          <EmptyHeader>
                            <EmptyMedia variant="icon">
                              <TrophyIcon aria-hidden="true" />
                            </EmptyMedia>
                            <EmptyTitle>
                              {hasSnapshot
                                ? "当前分区暂无榜单数据"
                                : "尚未导入 B 站排行榜"}
                            </EmptyTitle>
                            <EmptyDescription>
                              {hasSnapshot
                                ? "本次导入没有该分区的数据。"
                                : "请先执行离线榜单导入命令。"}
                            </EmptyDescription>
                          </EmptyHeader>
                        </Empty>
                      )
                    ) : (
                      <Table className="table-fixed tabular-nums">
                        <TableHeader>
                          {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                              {headerGroup.headers.map((header) => (
                                <TableHead
                                  key={header.id}
                                  className={
                                    header.column.columnDef.meta?.className
                                  }
                                >
                                  {header.isPlaceholder ? null : (
                                    <table.FlexRender header={header} />
                                  )}
                                </TableHead>
                              ))}
                            </TableRow>
                          ))}
                        </TableHeader>
                        <TableBody>
                          {rows.map((row) => (
                            <TableRow key={row.id}>
                              {row.getAllCells().map((cell) => (
                                <TableCell
                                  key={cell.id}
                                  className={
                                    cell.column.columnDef.meta?.className
                                  }
                                >
                                  <table.FlexRender cell={cell} />
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}

                    <PagePagination
                      className="mt-auto"
                      ariaLabel="B 站排行榜分页"
                      currentPage={currentPage}
                      pageCount={pageCount}
                      getPageHref={(page) =>
                        getRankingsHref("bilibili", page, category)
                      }
                    />
                  </>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </section>
      </div>
    </>
  );
}

function getPlatform(value: string | null): PlatformCode {
  return (
    PLATFORMS.find((platform) => platform.code === value)?.code ?? "bilibili"
  );
}

function getRankingsHref(
  platform: PlatformCode,
  page: number,
  category?: BilibiliRankingCategoryCode,
): string {
  const parameters = new URLSearchParams({ platform });

  if (platform === "bilibili" && category && category !== "all") {
    parameters.set("category", category);
  }

  return getPaginationHref(
    "/admin/content-operations/rankings",
    page,
    parameters,
  );
}

function getCategory(value: string | null): BilibiliRankingCategoryCode {
  return value !== null && isBilibiliCategoryCode(value) ? value : "all";
}

function isBilibiliCategoryCode(
  value: string,
): value is BilibiliRankingCategoryCode {
  return Object.hasOwn(BILIBILI_CATEGORY_CODES, value);
}

function getCategoryName(
  ranking: { categories: Array<{ code: string; name: string }> } | undefined,
  category: BilibiliRankingCategoryCode,
): string {
  return (
    ranking?.categories.find((item) => item.code === category)?.name ?? "全部"
  );
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return [hours, minutes, remainingSeconds]
      .map((value) => String(value).padStart(2, "0"))
      .join(":");
  }

  return [minutes, remainingSeconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}
