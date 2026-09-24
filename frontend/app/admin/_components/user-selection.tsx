"use client";

import { useState, useId } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { XIcon } from "lucide-react";

import { projectsReadMemberCandidates, usersReadUsers } from "@/lib/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";

import { SelectionPopover } from "./selection-popover";

export type SelectedUser = { user_id: string; username: string };

export function UserSelection({
  projectId,
  selected,
  onChange,
  disabled,
}: {
  projectId?: string;
  selected: SelectedUser[];
  onChange: (users: SelectedUser[]) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const query = useInfiniteQuery({
    queryKey: ["member-candidates", projectId, search],
    enabled: open,
    initialPageParam: 0,
    meta: { handlesInitialError: true },
    queryFn: async ({ pageParam, signal }) => {
      const query = { search, skip: pageParam, limit: 20 };

      if (projectId)
        return (
          await projectsReadMemberCandidates({
            path: { project_id: projectId },
            query,
            signal,
            throwOnError: true,
          })
        ).data;

      const result = (
        await usersReadUsers({
          query: { ...query, is_active: true },
          signal,
          throwOnError: true,
        })
      ).data;

      return {
        count: result.count,
        data: result.data.map((user) => ({
          user_id: user.id,
          username: user.username,
          full_name: user.full_name,
          is_member: user.is_superuser,
        })),
      };
    },
    getNextPageParam: (page, pages) =>
      pages.reduce((n, p) => n + p.data.length, 0) < page.count
        ? pages.length * 20
        : undefined,
  });

  const items = query.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <div className="flex flex-col gap-2">
      <SelectionPopover
        label="选择用户"
        searchLabel="搜索账号或姓名"
        open={open}
        onOpenChange={setOpen}
        onSearch={setSearch}
        disabled={disabled}
      >
        <FieldSet>
          <FieldLegend className="sr-only">选择用户</FieldLegend>
          <FieldGroup data-slot="checkbox-group">
            {items.map((user) => {
              const checked = selected.some((x) => x.user_id === user.user_id);
              const unavailable =
                disabled ||
                user.is_member ||
                (selected.length >= 100 && !checked);
              return (
                <Field
                  key={user.user_id}
                  orientation="horizontal"
                  data-disabled={unavailable}
                >
                  <Checkbox
                    id={`${id}-${user.user_id}`}
                    checked={checked}
                    disabled={unavailable}
                    onCheckedChange={(value) =>
                      onChange(
                        value === true
                          ? [
                              ...selected,
                              {
                                user_id: user.user_id,
                                username: user.username,
                              },
                            ]
                          : selected.filter((x) => x.user_id !== user.user_id),
                      )
                    }
                  />
                  <FieldLabel htmlFor={`${id}-${user.user_id}`}>
                    {user.username}
                    {user.full_name && ` / ${user.full_name}`}
                  </FieldLabel>
                  {user.is_member && (
                    <Badge variant="secondary">已有权限</Badge>
                  )}
                </Field>
              );
            })}
            {query.isPending ? (
              <FieldDescription role="status">正在加载…</FieldDescription>
            ) : query.isError ? (
              <Button
                type="button"
                variant="ghost"
                disabled={disabled || query.isFetching}
                onClick={() => void query.refetch()}
              >
                加载失败，点击重试
              </Button>
            ) : (
              !items.length && (
                <FieldDescription role="status">
                  没有匹配的账号
                </FieldDescription>
              )
            )}
            {query.hasNextPage && (
              <Button
                type="button"
                variant="ghost"
                disabled={disabled || query.isFetchingNextPage}
                onClick={() => void query.fetchNextPage()}
              >
                加载更多
              </Button>
            )}
          </FieldGroup>
        </FieldSet>
      </SelectionPopover>
      {selected.length > 0 && (
        <div
          className="flex max-h-24 flex-wrap gap-2 overflow-y-auto overscroll-contain p-1"
          role="group"
          aria-label="已选用户"
        >
          {selected.map((user) => (
            <Button
              key={user.user_id}
              type="button"
              variant="outline"
              size="sm"
              className="max-w-full"
              disabled={disabled}
              aria-label={`移除已选用户 ${user.username}`}
              onClick={() =>
                onChange(selected.filter((x) => x.user_id !== user.user_id))
              }
            >
              <span className="truncate">{user.username}</span>
              <XIcon data-icon="inline-end" aria-hidden="true" />
            </Button>
          ))}
        </div>
      )}
      <FieldDescription role="status">
        {selected.length > 0
          ? `已选 ${selected.length} 人，最多可选 100 人。`
          : "最多可选 100 人。"}
      </FieldDescription>
    </div>
  );
}
