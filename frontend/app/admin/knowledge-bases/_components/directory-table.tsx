"use client";

import { FolderIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import {
  getDirectoryEntryKey,
  type DirectoryEntry,
} from "@/app/admin/knowledge-bases/_lib/directory";
import { getKnowledgeDirectoryHref } from "@/app/admin/knowledge-bases/_lib/navigation";

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
import type { KnowledgeDocumentPublic } from "@/lib/client";
import { formatFileSize } from "@/lib/file-types";

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
});

const statusLabels: Record<KnowledgeDocumentPublic["status"], string> = {
  pending: "等待处理",
  processing: "处理中",
  ready: "可用",
  failed: "失败",
  timed_out: "已超时",
};

export function KnowledgeDirectoryTable({
  knowledgeBaseId,
  entries,
  selectedEntryKeys,
  onSelectionChange,
  getDocumentHref,
  renderActions,
}: {
  knowledgeBaseId: string;
  entries: DirectoryEntry[];
  selectedEntryKeys: ReadonlySet<string>;
  onSelectionChange: (keys: Set<string>) => void;
  getDocumentHref: (documentId: string) => string;
  renderActions: (entry: DirectoryEntry) => ReactNode;
}) {
  const selectedEntryCount = entries.filter((entry) =>
    selectedEntryKeys.has(getDirectoryEntryKey(entry)),
  ).length;
  const allEntriesSelected =
    entries.length > 0 && selectedEntryCount === entries.length;
  const someEntriesSelected = selectedEntryCount > 0 && !allEntriesSelected;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>
            <Checkbox
              aria-label="选择当前页全部项目"
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
          <TableHead>状态</TableHead>
          <TableHead>大小</TableHead>
          <TableHead>添加时间</TableHead>
          <TableHead>操作</TableHead>
        </TableRow>
      </TableHeader>

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
                    href={getKnowledgeDirectoryHref(
                      knowledgeBaseId,
                      1,
                      entry.id,
                    )}
                    className="flex max-w-md items-center gap-2 hover:underline"
                  >
                    <FolderIcon
                      className="size-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span className="truncate">{entry.name}</span>
                  </Link>
                ) : (
                  <div className="max-w-md">
                    <div className="truncate">
                      {entry.status === "ready" ? (
                        <Link
                          href={getDocumentHref(entry.id)}
                          className="hover:underline"
                        >
                          {entry.filename}
                        </Link>
                      ) : (
                        entry.filename
                      )}
                    </div>
                    {entry.error_message ? (
                      <p className="text-destructive whitespace-normal break-words">
                        {entry.error_message}
                      </p>
                    ) : null}
                  </div>
                )}
              </TableCell>
              <TableCell>
                {entry.type === "folder" ? (
                  "—"
                ) : (
                  <Badge
                    variant={entry.status === "ready" ? "outline" : "secondary"}
                  >
                    {entry.status === "pending" && !entry.uploaded
                      ? "等待确认上传"
                      : statusLabels[entry.status]}
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
    </Table>
  );
}
