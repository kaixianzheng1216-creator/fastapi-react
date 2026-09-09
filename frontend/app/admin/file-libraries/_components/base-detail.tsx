"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";

import { LibraryDocuments } from "@/app/admin/file-libraries/_components/documents";
import { AppHeader } from "@/components/layout/app-header";
import { LoadError } from "@/components/common/load-error";
import { TableSkeleton } from "@/components/common/table-skeleton";
import { Button } from "@/components/ui/button";
import { fileLibrariesReadFileLibrary } from "@/lib/client";

export function FileLibraryDetail({
  fileLibraryId,
}: {
  fileLibraryId: string;
}) {
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
        left={
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href="/admin/file-libraries" aria-label="返回文件库列表">
              <ArrowLeftIcon aria-hidden="true" />
            </Link>
          </Button>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mx-auto flex min-h-full max-w-6xl flex-col gap-6">
          {libraryQuery.isPending ? (
            <TableSkeleton columns={6} />
          ) : libraryQuery.isError && libraryQuery.data === undefined ? (
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
