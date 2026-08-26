"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  createColumnHelper,
  rowPaginationFeature,
  rowSortingFeature,
  type SortingState,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import {
  AlertCircleIcon,
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  ChevronDownIcon,
  ChevronsUpDownIcon,
  ChevronUpIcon,
  RefreshCwIcon,
  MinusIcon,
  TablePropertiesIcon,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { AppHeader } from "@/components/layout/app-header";
import { PagePagination } from "@/components/shared/page-pagination";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  brandMarketingReadRegionalData,
  brandMarketingRefreshRegionalData,
  type ProvinceAnnualDataPublic,
  type RegionalIndicatorCode,
  type RegionalSortOrder,
} from "@/lib/client";
import { getPaginationHref, parsePage } from "@/lib/pagination";

const PAGE_SIZE = 20;
const DEFAULT_SORT_BY: RegionalIndicatorCode = "resident_population";
const DEFAULT_SORT_ORDER: RegionalSortOrder = "desc";
const REGIONAL_DATA_QUERY_KEY = ["brand-marketing-regional-data"] as const;

const EMPTY_REGIONS: ProvinceAnnualDataPublic[] = [];

const REGIONAL_INDICATORS = [
  {
    code: "resident_population",
    yoyCode: "resident_population_yoy",
    name: "年末常住人口",
    unit: "万人",
  },
  {
    code: "disposable_income",
    yoyCode: "disposable_income_yoy",
    name: "全体居民人均可支配收入",
    unit: "元",
  },
  {
    code: "consumption_expenditure",
    yoyCode: "consumption_expenditure_yoy",
    name: "全体居民人均消费支出",
    unit: "元",
  },
  {
    code: "retail_sales",
    yoyCode: "retail_sales_yoy",
    name: "社会消费品零售总额",
    unit: "亿元",
  },
] as const;

const numberFormatter = new Intl.NumberFormat("zh-CN", {
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("zh-CN", {
  style: "percent",
  maximumFractionDigits: 1,
});

const regionalTableFeatures = tableFeatures({
  rowPaginationFeature,
  rowSortingFeature,
});

const regionalColumnHelper = createColumnHelper<
  typeof regionalTableFeatures,
  ProvinceAnnualDataPublic
>();

function createRegionalColumns(previousYear: number | undefined) {
  return regionalColumnHelper.columns([
    regionalColumnHelper.accessor("province_name", {
      header: "地区",
      enableSorting: false,
      cell: ({ row }) => row.original.province_name,
    }),
    ...REGIONAL_INDICATORS.map((indicator) =>
      regionalColumnHelper.accessor(indicator.code, {
        sortDescFirst: true,
        header: ({ column }) => {
          const sortDirection = column.getIsSorted();
          const SortIcon =
            sortDirection === "asc"
              ? ChevronUpIcon
              : sortDirection === "desc"
                ? ChevronDownIcon
                : ChevronsUpDownIcon;

          return (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-end"
              onClick={column.getToggleSortingHandler()}
              aria-label={`按${indicator.name}${
                sortDirection === "desc" ? "升序" : "降序"
              }排列`}
            >
              {indicator.name} ({indicator.unit})
              <SortIcon data-icon="inline-end" aria-hidden="true" />
            </Button>
          );
        },
        cell: ({ row }) => {
          const changeRate = row.original[indicator.yoyCode];

          return (
            <div className="flex items-center justify-end gap-2">
              <span>{numberFormatter.format(row.original[indicator.code])}</span>
              {previousYear === undefined ? null : (
                <ChangeBadge value={changeRate} />
              )}
            </div>
          );
        },
      }),
    ),
  ]);
}

export function RegionalData() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const currentPage = parsePage(searchParams.get("page"));
  const pageIndex = currentPage - 1;

  const year = getYear(searchParams.get("year"));
  const sortBy = getSortBy(searchParams.get("sort"));
  const sortOrder = getSortOrder(searchParams.get("order"));
  const sorting = useMemo<SortingState>(
    () => [{ id: sortBy, desc: sortOrder === "desc" }],
    [sortBy, sortOrder],
  );

  const regionalDataQuery = useQuery({
    queryKey: [
      ...REGIONAL_DATA_QUERY_KEY,
      year,
      pageIndex,
      sortBy,
      sortOrder,
    ],
    queryFn: async ({ signal }) => {
      const { data } = await brandMarketingReadRegionalData({
        query: {
          year,
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
    retry: false,
  });

  const refreshData = useMutation({
    mutationFn: async (): Promise<void> => {
      await brandMarketingRefreshRegionalData({ throwOnError: true });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: REGIONAL_DATA_QUERY_KEY });
    },
  });

  const regionalData = regionalDataQuery.data;
  const loadError = regionalDataQuery.error
    ? getApiErrorMessage(regionalDataQuery.error, "读取区域数据失败")
    : "";
  const refreshError = refreshData.error
    ? getApiErrorMessage(refreshData.error, "刷新区域数据失败")
    : "";
  const selectedYear = year ?? regionalData?.year;
  const previousYear =
    selectedYear === undefined ? undefined : selectedYear - 1;
  const columns = useMemo(
    () => createRegionalColumns(previousYear),
    [previousYear],
  );

  const table = useTable({
    features: regionalTableFeatures,
    data: regionalData?.data ?? EMPTY_REGIONS,
    columns,
    getRowId: (region) => region.province_code,
    enableSortingRemoval: false,
    manualPagination: true,
    manualSorting: true,
    rowCount: regionalData?.count ?? 0,
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
        getRegionalDataHref(
          1,
          year,
          nextSort.id as RegionalIndicatorCode,
          nextSort.desc ? "desc" : "asc",
        ),
      );
    },
  });

  const rows = table.getRowModel().rows;
  const pageCount = table.getPageCount();

  return (
    <>
      <AppHeader
        title="区域数据"
        left={<SidebarTrigger className="size-9" aria-label="切换管理菜单" />}
        actions={
          <Button
            variant="outline"
            disabled={refreshData.isPending}
            onClick={() => refreshData.mutate()}
          >
            {refreshData.isPending ? (
              <Spinner
                data-icon="inline-start"
                aria-label="正在刷新区域数据"
              />
            ) : (
              <RefreshCwIcon data-icon="inline-start" aria-hidden="true" />
            )}
            刷新数据
          </Button>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
        <section className="mx-auto flex min-h-full max-w-7xl flex-col gap-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-1">
              <h2 className="font-semibold">分省年度数据</h2>
              <p className="text-sm text-muted-foreground">
                各省级地区人口、收入和消费指标
                {previousYear === undefined
                  ? ""
                  : ` · 同比基准：${previousYear}年`}
                {regionalData ? ` · 数据来源：${regionalData.source}` : ""}
              </p>
            </div>

            {regionalData ? (
              <Field orientation="horizontal" className="w-auto">
                <FieldLabel htmlFor="regional-data-year">年份</FieldLabel>
                <Select
                  value={String(year ?? regionalData.year)}
                  onValueChange={(value) =>
                    router.push(
                      getRegionalDataHref(
                        1,
                        Number(value),
                        sortBy,
                        sortOrder,
                      ),
                    )
                  }
                >
                  <SelectTrigger id="regional-data-year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {regionalData.years.map((availableYear) => (
                        <SelectItem
                          key={availableYear}
                          value={String(availableYear)}
                        >
                          {availableYear}年
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
          </div>

          {refreshError ? (
            <Alert variant="destructive">
              <AlertCircleIcon aria-hidden="true" />
              <AlertTitle>{refreshError}</AlertTitle>
            </Alert>
          ) : null}

          {regionalDataQuery.isPending ? (
            <Skeleton className="h-96" />
          ) : loadError ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <AlertCircleIcon aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>无法读取区域数据</EmptyTitle>
                <EmptyDescription>{loadError}</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => regionalDataQuery.refetch()}
                >
                  重试
                </Button>
              </EmptyContent>
            </Empty>
          ) : rows.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <TablePropertiesIcon aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>暂无区域数据</EmptyTitle>
                <EmptyDescription>当前年份还没有可展示的数据。</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table className="tabular-nums">
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const sortDirection = header.column.getIsSorted();

                      return (
                        <TableHead
                          key={header.id}
                          className={
                            header.column.id === "province_name"
                              ? "w-44 min-w-44 max-w-44"
                              : undefined
                          }
                          aria-sort={
                            sortDirection === "asc"
                              ? "ascending"
                              : sortDirection === "desc"
                                ? "descending"
                                : undefined
                          }
                        >
                          {header.isPlaceholder ? null : (
                            <table.FlexRender header={header} />
                          )}
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
                          cell.column.id === "province_name"
                            ? "w-44 min-w-44 max-w-44"
                            : "text-right"
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
            ariaLabel="区域数据分页"
            currentPage={currentPage}
            pageCount={pageCount}
            getPageHref={(page) =>
              getRegionalDataHref(page, year, sortBy, sortOrder)
            }
          />
        </section>
      </div>
    </>
  );
}

function ChangeBadge({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <Badge variant="outline" aria-label="无同比数据">
        —
      </Badge>
    );
  }

  const ChangeIcon =
    value > 0
      ? ArrowUpRightIcon
      : value < 0
        ? ArrowDownRightIcon
        : MinusIcon;
  const direction = value > 0 ? "上升" : value < 0 ? "下降" : "持平";

  return (
    <Badge
      variant="outline"
      className="min-w-16 justify-start tabular-nums"
      aria-label={`同比${direction}${percentFormatter.format(Math.abs(value))}`}
    >
      <ChangeIcon aria-hidden="true" />
      {percentFormatter.format(Math.abs(value))}
    </Badge>
  );
}

function getYear(value: string | null): number | undefined {
  const year = Number(value);
  return Number.isInteger(year) && year >= 1900 && year <= 2100
    ? year
    : undefined;
}

function getSortBy(value: string | null): RegionalIndicatorCode {
  if (
    value === "disposable_income" ||
    value === "consumption_expenditure" ||
    value === "retail_sales"
  ) {
    return value;
  }

  return DEFAULT_SORT_BY;
}

function getSortOrder(value: string | null): RegionalSortOrder {
  return value === "asc" ? "asc" : DEFAULT_SORT_ORDER;
}

function getRegionalDataHref(
  page: number,
  year: number | undefined,
  sortBy: RegionalIndicatorCode,
  sortOrder: RegionalSortOrder,
): string {
  const parameters = new URLSearchParams();

  if (year !== undefined) {
    parameters.set("year", String(year));
  }

  if (sortBy !== DEFAULT_SORT_BY) {
    parameters.set("sort", sortBy);
  }

  if (sortOrder !== DEFAULT_SORT_ORDER) {
    parameters.set("order", sortOrder);
  }

  return getPaginationHref(
    "/admin/brand-marketing/regional-data",
    page,
    parameters,
  );
}
