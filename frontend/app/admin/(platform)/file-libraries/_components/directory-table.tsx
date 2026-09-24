"use client";

import { usePaginationScrollReset } from "@/hooks/use-pagination-scroll-reset";

import { FolderIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import {
  getDirectoryEntryKey,
  type DirectoryEntry,
} from "@/app/admin/(platform)/file-libraries/_lib/directory";
import { getLibraryDirectoryHref } from "@/app/admin/(platform)/file-libraries/_lib/navigation";

import { TableSkeletonBody } from "@/components/common/table-skeleton";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatFileSize } from "@/lib/file-types";

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeStyle: "medium",
  hour12: false,
});

export function LibraryDirectoryTable({
  currentPage,
  loading,
  fileLibraryId,
  entries,
  selectedEntryKeys,
  onSelectionChange,
  renderActions,
}: {
  currentPage: number;
  loading: boolean;
  fileLibraryId: string;
  entries: DirectoryEntry[];
  selectedEntryKeys: ReadonlySet<string>;
  onSelectionChange: (keys: Set<string>) => void;
  renderActions: (entry: DirectoryEntry) => ReactNode;
}) {
  const scrollRef = usePaginationScrollReset<HTMLDivElement>(currentPage);

  const selectedEntryCount = entries.filter((entry) =>
    selectedEntryKeys.has(getDirectoryEntryKey(entry)),
  ).length;
  const allEntriesSelected =
    entries.length > 0 && selectedEntryCount === entries.length;
  const someEntriesSelected = selectedEntryCount > 0 && !allEntriesSelected;

  return (
    <Table
      loading={loading}
      className="min-w-[880px] table-fixed [&_tbody_tr]:h-12"
      containerRef={scrollRef}
      containerClassName="md:scroll-content-y md:h-full md:overscroll-contain"
    >
      <TableHeader className="sticky top-0 z-10 bg-background">
        <TableRow>
          <TableHead className="w-10">
            <Checkbox
              aria-label="选择当前页全部项目"
              disabled={loading}
              checked={
                allEntriesSelected
                  ? true
                  : someEntriesSelected
                    ? "indeterminate"
                    : false
              }
              onCheckedChange={(checked) =>
                onSelectionChange(
                  checked === true
                    ? new Set(entries.map(getDirectoryEntryKey))
                    : new Set(),
                )
              }
            />
          </TableHead>
          <TableHead>名称</TableHead>
          <TableHead className="w-32">状态</TableHead>
          <TableHead className="w-24">大小</TableHead>
          <TableHead className="w-44">添加时间</TableHead>
          <TableHead className="w-16">操作</TableHead>
        </TableRow>
      </TableHeader>

      {loading ? (
        <TableSkeletonBody columns={6} />
      ) : (
        <TableBody>
          {entries.map((entry) => {
            const key = getDirectoryEntryKey(entry);
            const name = entry.type === "folder" ? entry.name : entry.filename;

            return (
              <TableRow
                key={key}
                data-state={selectedEntryKeys.has(key) ? "selected" : undefined}
              >
                <TableCell>
                  <Checkbox
                    aria-label={`选择 ${name}`}
                    checked={selectedEntryKeys.has(key)}
                    onCheckedChange={(checked) => {
                      const keys = new Set(selectedEntryKeys);

                      if (checked === true) keys.add(key);
                      else keys.delete(key);

                      onSelectionChange(keys);
                    }}
                  />
                </TableCell>
                <TableCell>
                  {entry.type === "folder" ? (
                    <Link
                      href={getLibraryDirectoryHref(fileLibraryId, 1, entry.id)}
                      className="flex min-w-0 items-center gap-2 hover:underline"
                    >
                      <FolderIcon
                        className="size-4 shrink-0"
                        aria-hidden="true"
                      />
                      <span className="truncate">{entry.name}</span>
                    </Link>
                  ) : (
                    <span className="block min-w-0 truncate">
                      {entry.filename}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {entry.type === "folder" ? (
                    "—"
                  ) : (
                    <Badge variant={entry.uploaded ? "outline" : "secondary"}>
                      {entry.uploaded ? "已上传" : "等待确认上传"}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="tabular-nums">
                  {entry.type === "folder" ? "—" : formatFileSize(entry.size)}
                </TableCell>
                <TableCell>
                  {dateFormatter.format(new Date(entry.created_at))}
                </TableCell>
                <TableCell>{renderActions(entry)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      )}
    </Table>
  );
}
