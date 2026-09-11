"use client";

import { CollectionContent } from "@/components/common/collection-content";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  createColumnHelper,
  metaHelper,
  rowPaginationFeature,
  rowSortingFeature,
  type SortingState,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import {
  ChevronDownIcon,
  ChevronsUpDownIcon,
  ChevronUpIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useMemo } from "react";

import { DataRefreshButton } from "@/components/common/data-refresh-button";
import { AppHeader } from "@/components/layout/app-header";
import { LoadError } from "@/components/common/load-error";
import { PageOutOfRange } from "@/components/common/page-out-of-range";
import { PagePagination } from "@/components/common/page-pagination";
import { SearchToolbar } from "@/components/common/search-toolbar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { TableSkeleton } from "@/components/common/table-skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getPaginationHref, parsePage } from "@/lib/pagination";
import {
  type InfluencerAccountPublic,
  type InfluencerAccountSortBy,
  type InfluencerPlatformCode,
  type InfluencerSortOrder,
  influencerMarketingReadInfluencerAccounts,
} from "@/lib/client";

const PAGE_SIZE = 20;
const DEFAULT_SORT_BY: InfluencerAccountSortBy = "followers";
const DEFAULT_SORT_ORDER: InfluencerSortOrder = "desc";
const EMPTY_ACCOUNTS: InfluencerAccountPublic[] = [];

const PLATFORMS: Record<InfluencerPlatformCode, string> = {
  douyin: "抖音",
  xiaohongshu: "小红书",
};

const countFormatter = new Intl.NumberFormat("zh-CN", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const capturedAtFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeStyle: "short",
});

const influencerTableFeatures = tableFeatures({
  rowPaginationFeature,
  rowSortingFeature,
  columnMeta: metaHelper<{ className?: string }>(),
});

const influencerColumnHelper = createColumnHelper<
  typeof influencerTableFeatures,
  InfluencerAccountPublic
>();

export function InfluencerResourceManager() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const platform = getPlatform(searchParams.get("platform"));
  const search = searchParams.get("search")?.trim() ?? "";
  const currentPage = parsePage(searchParams.get("page"));
  const pageIndex = currentPage - 1;
  const platformName = PLATFORMS[platform];
  const sortBy = getSortBy(searchParams.get("sort"));
  const sortOrder = getSortOrder(searchParams.get("order"));
  const sorting = useMemo<SortingState>(
    () => [{ id: sortBy, desc: sortOrder === "desc" }],
    [sortBy, sortOrder],
  );

  const accountsQuery = useQuery({
    meta: { handlesInitialError: true },
    queryKey: [
      "influencer-accounts",
      platform,
      search,
      pageIndex,
      sortBy,
      sortOrder,
    ],
    queryFn: async ({ signal }) => {
      const { data } = await influencerMarketingReadInfluencerAccounts({
        query: {
          platform,
          search: search || undefined,
          skip: pageIndex * PAGE_SIZE,
          limit: PAGE_SIZE,
          sort_by: sortBy,
          sort_order: sortOrder,
        },
        signal,
        throwOnError: true,
      });

      return data;
    },
    placeholderData: keepPreviousData,
  });

  const columns = useMemo(
    () =>
      influencerColumnHelper.columns([
        influencerColumnHelper.accessor("nickname", {
          header: "达人",
          cell: ({ row }) => (
            <InfluencerIdentity
              account={row.original}
              platformName={platformName}
            />
          ),
          meta: { className: "w-[48%] whitespace-normal" },
        }),
        influencerColumnHelper.accessor("location", {
          header: "地区",
          cell: ({ row }) => row.original.location || "—",
          meta: { className: "w-24" },
        }),
        influencerColumnHelper.accessor("followers", {
          sortDescFirst: true,
          header: ({ column }) => (
            <SortableHeader
              label="粉丝数"
              direction={column.getIsSorted()}
              onToggle={() => column.toggleSorting()}
            />
          ),
          cell: ({ row }) => countFormatter.format(row.original.followers),
          meta: { className: "w-28 text-right" },
        }),
        influencerColumnHelper.accessor("engagement_count", {
          sortDescFirst: true,
          header: ({ column }) => (
            <SortableHeader
              label={platform === "douyin" ? "获赞" : "获赞与收藏"}
              direction={column.getIsSorted()}
              onToggle={() => column.toggleSorting()}
            />
          ),
          cell: ({ row }) => formatCount(row.original.engagement_count),
          meta: { className: "w-32 text-right" },
        }),
      ]),
    [platform, platformName],
  );

  const table = useTable({
    features: influencerTableFeatures,
    data: accountsQuery.data?.data ?? EMPTY_ACCOUNTS,
    columns,
    getRowId: (account) => account.profile_url,
    enableSortingRemoval: false,
    manualPagination: true,
    manualSorting: true,
    rowCount: accountsQuery.data?.count ?? 0,
    state: {
      pagination: {
        pageIndex,
        pageSize: PAGE_SIZE,
      },
      sorting,
    },
    onSortingChange: (updater) => {
      const nextSorting =
        typeof updater === "function" ? updater(sorting) : updater;
      const nextSort = nextSorting[0]!;

      router.push(
        getInfluencerResourcesHref(
          platform,
          1,
          search,
          getSortBy(nextSort.id),
          nextSort.desc ? "desc" : "asc",
        ),
      );
    },
  });

  const rows = table.getRowModel().rows;
  const pageCount = table.getPageCount();
  const pageOutOfRange =
    (accountsQuery.data?.count ?? 0) > 0 && rows.length === 0;

  function submitSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const nextSearch = String(formData.get("search") ?? "").trim();

    router.push(
      getInfluencerResourcesHref(platform, 1, nextSearch, sortBy, sortOrder),
    );
  }

  return (
    <>
      <AppHeader
        actions={<DataRefreshButton source="influencers" queryKey={["influencer-accounts"]} />}
        title="达人资源"
        left={<SidebarTrigger className="size-9" aria-label="切换管理菜单" />}
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
        <section className="mx-auto flex min-h-full max-w-7xl flex-col gap-6">
          <div className="flex flex-col gap-1">
            <h2 className="font-semibold">达人资源</h2>
            <p className="text-sm text-muted-foreground">
              查看抖音和小红书达人账号数据。
            </p>
          </div>

          <Tabs
            className="flex-1 gap-6"
            value={platform}
            onValueChange={(value) =>
              router.push(
                getInfluencerResourcesHref(
                  getPlatform(value),
                  1,
                  search,
                  sortBy,
                  sortOrder,
                ),
              )
            }
          >
            <TabsList className="w-full sm:w-64" variant="line">
              {Object.entries(PLATFORMS).map(([code, name]) => (
                <TabsTrigger key={code} value={code}>
                  {name}
                </TabsTrigger>
              ))}
            </TabsList>

            {Object.keys(PLATFORMS).map((code) => (
              <TabsContent
                key={code}
                value={code}
                className="flex flex-col gap-6"
                aria-busy={code === platform && accountsQuery.isFetching}
              >
                {code === platform && (
                  <>
                    <div className="flex flex-wrap items-end justify-between gap-4">
                      <div className="flex flex-col gap-1">
                        <h3 className="font-medium">{platformName}达人</h3>
                        {accountsQuery.isPending ? (
                          <Skeleton className="h-4 w-48" />
                        ) : accountsQuery.isError &&
                          accountsQuery.data === undefined ? null : (
                          <p
                            className="text-sm text-muted-foreground"
                            aria-live="polite"
                          >
                            {accountsQuery.data?.captured_at
                              ? `采集于 ${capturedAtFormatter.format(new Date(accountsQuery.data.captured_at))} · 共 ${accountsQuery.data.count} 位达人`
                              : "尚未导入达人数据"}
                          </p>
                        )}
                      </div>

                      <SearchToolbar
                        id="influencer-search"
                        label="搜索昵称或平台账号"
                        placeholder="搜索昵称或平台账号…"
                        onSubmit={submitSearch}
                        key={search}
                        defaultValue={search}
                        maxLength={255}
                      />
                    </div>

                    {accountsQuery.isPending ? (
                      <TableSkeleton columns={4} rows={7} />
                    ) : accountsQuery.isError &&
                      accountsQuery.data === undefined ? (
                      <LoadError
                        title="达人数据加载失败"
                        isRetrying={accountsQuery.isFetching}
                        onRetry={() => void accountsQuery.refetch()}
                      />
                    ) : rows.length === 0 ? (
                      pageOutOfRange ? (
                        <PageOutOfRange
                          href={getInfluencerResourcesHref(
                            platform,
                            1,
                            search,
                            sortBy,
                            sortOrder,
                          )}
                        />
                      ) : (
                        <Empty>
                          <EmptyHeader>
                            <EmptyMedia variant="icon">
                              <UsersIcon aria-hidden="true" />
                            </EmptyMedia>
                            <EmptyTitle>
                              {search ? "未找到符合条件的达人" : "暂无达人数据"}
                            </EmptyTitle>
                          </EmptyHeader>
                        </Empty>
                      )
                    ) : (
                      <CollectionContent busy={accountsQuery.isFetching}>
                        <Table className="table-fixed tabular-nums">
                          <TableHeader>
                            {table.getHeaderGroups().map((headerGroup) => (
                              <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                  const sortDirection =
                                    header.column.getIsSorted();

                                  return (
                                    <TableHead
                                      key={header.id}
                                      className={
                                        header.column.columnDef.meta?.className
                                      }
                                      aria-sort={
                                        sortDirection === "asc"
                                          ? "ascending"
                                          : sortDirection === "desc"
                                            ? "descending"
                                            : undefined
                                      }
                                    >
                                      <table.FlexRender header={header} />
                                    </TableHead>
                                  );
                                })}
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
                      </CollectionContent>
                    )}

                    <PagePagination
                      className="mt-auto"
                      ariaLabel={`${platformName}达人分页`}
                      currentPage={currentPage}
                      pageCount={pageCount}
                      getPageHref={(page) =>
                        getInfluencerResourcesHref(
                          platform,
                          page,
                          search,
                          sortBy,
                          sortOrder,
                        )
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

function SortableHeader({
  label,
  direction,
  onToggle,
}: {
  label: string;
  direction: false | "asc" | "desc";
  onToggle: () => void;
}) {
  const SortIcon =
    direction === "asc"
      ? ChevronUpIcon
      : direction === "desc"
        ? ChevronDownIcon
        : ChevronsUpDownIcon;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="w-full justify-end"
      onClick={onToggle}
      aria-label={`按${label}${direction === "desc" ? "升序" : "降序"}排列`}
    >
      {label}
      <SortIcon data-icon="inline-end" aria-hidden="true" />
    </Button>
  );
}

function InfluencerIdentity({
  account,
  platformName,
}: {
  account: InfluencerAccountPublic;
  platformName: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar className="size-12">
        {account.avatar_url ? (
          <AvatarImage src={account.avatar_url} alt="" />
        ) : null}
        <AvatarFallback>{account.nickname.charAt(0)}</AvatarFallback>
      </Avatar>

      <div className="min-w-0">
        <Link
          className="break-words font-medium hover:underline"
          href={account.profile_url}
          target="_blank"
          rel="noreferrer"
        >
          {account.nickname}
        </Link>
        <p className="truncate text-xs text-muted-foreground">
          {platformName}号：{account.public_account_id}
        </p>
        {account.bio ? (
          <p className="truncate text-sm text-muted-foreground">
            {account.bio}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function formatCount(value: number | null): string {
  return value === null ? "—" : countFormatter.format(value);
}

function getPlatform(value: string | null): InfluencerPlatformCode {
  return value === "xiaohongshu" ? "xiaohongshu" : "douyin";
}

function getSortBy(value: string | null): InfluencerAccountSortBy {
  return value === "engagement_count" ? "engagement_count" : DEFAULT_SORT_BY;
}

function getSortOrder(value: string | null): InfluencerSortOrder {
  return value === "asc" ? "asc" : DEFAULT_SORT_ORDER;
}

function getInfluencerResourcesHref(
  platform: InfluencerPlatformCode,
  page: number,
  search: string,
  sortBy: InfluencerAccountSortBy,
  sortOrder: InfluencerSortOrder,
): string {
  const parameters = new URLSearchParams();

  if (platform !== "douyin") {
    parameters.set("platform", platform);
  }

  if (search) {
    parameters.set("search", search);
  }

  if (sortBy !== DEFAULT_SORT_BY) {
    parameters.set("sort", sortBy);
  }

  if (sortOrder !== DEFAULT_SORT_ORDER) {
    parameters.set("order", sortOrder);
  }

  return getPaginationHref(
    "/admin/influencer-marketing/resources",
    page,
    parameters,
  );
}
