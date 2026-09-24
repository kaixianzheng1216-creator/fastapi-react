"use client";

import { usePaginationScrollReset } from "@/hooks/use-pagination-scroll-reset";
import { parsePage } from "@/lib/pagination";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";

import { LibraryDocuments } from "@/app/admin/(platform)/file-libraries/_components/documents";
import { AppHeader } from "@/components/layout/app-header";
import { getQueryViewState } from "@/lib/query-view-state";
import { LoadError } from "@/components/common/load-error";
import { fileLibrariesReadFileLibrary } from "@/lib/client";

export function FileLibraryDetail({
  fileLibraryId,
}: {
  fileLibraryId: string;
}) {
  const searchParams = useSearchParams();
  const scrollRef = usePaginationScrollReset<HTMLDivElement>(
    parsePage(searchParams.get("page")),
  );

  const libraryQuery = useQuery({
    meta: { handlesInitialError: true },
    queryKey: ["file-library", fileLibraryId],
    queryFn: async ({ signal }) => {
      const { data } = await fileLibrariesReadFileLibrary({
        path: { file_library_id: fileLibraryId },
        signal,
        throwOnError: true,
      });
      return data;
    },
  });

  return (
    <>
      <AppHeader
        title={libraryQuery.data?.name ?? "文件库详情"}
        breadcrumbs={[{ label: "文件库", href: "/admin/file-libraries" }]}
      />
      <div
        ref={scrollRef}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 md:overflow-hidden md:p-6"
      >
        <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-6 md:h-full md:min-h-0">
          {getQueryViewState(libraryQuery) === "error" ? (
            <LoadError
              title="文件库加载失败"
              isRetrying={libraryQuery.isFetching}
              onRetry={() => void libraryQuery.refetch()}
            />
          ) : (
            <LibraryDocuments
              key={fileLibraryId}
              fileLibraryId={fileLibraryId}
            />
          )}
        </div>
      </div>
    </>
  );
}
