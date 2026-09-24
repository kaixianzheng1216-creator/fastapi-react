"use client";

import { useId, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";

import {
  projectsReadProjects,
  type ProjectPublic,
  type ProjectRole,
} from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SelectionPopover } from "./selection-popover";

export type SelectedProject = { project: ProjectPublic; role: ProjectRole };

export function ProjectSelection({
  selected,
  onChange,
  disabled,
}: {
  selected: SelectedProject[];
  onChange: (projects: SelectedProject[]) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const query = useInfiniteQuery({
    queryKey: ["projects", "picker", search],
    enabled: open,
    initialPageParam: 0,
    meta: { handlesInitialError: true },
    queryFn: async ({ pageParam, signal }) =>
      (
        await projectsReadProjects({
          query: { search, skip: pageParam, limit: 20 },
          signal,
          throwOnError: true,
        })
      ).data,
    getNextPageParam: (page, pages) =>
      pages.reduce((n, p) => n + p.data.length, 0) < page.count
        ? pages.length * 20
        : undefined,
  });

  const items = query.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <div className="flex flex-col gap-2">
      <SelectionPopover
        label="选择项目"
        searchLabel="搜索项目"
        open={open}
        onOpenChange={setOpen}
        onSearch={setSearch}
        disabled={disabled}
      >
        <FieldSet>
          <FieldLegend className="sr-only">选择项目</FieldLegend>
          <FieldGroup data-slot="checkbox-group">
            {items.map((project) => {
              const checked = selected.some(
                (item) => item.project.id === project.id,
              );
              const unavailable =
                disabled || (selected.length >= 100 && !checked);
              return (
                <Field
                  key={project.id}
                  orientation="horizontal"
                  data-disabled={unavailable}
                >
                  <Checkbox
                    id={`${id}-${project.id}`}
                    checked={checked}
                    disabled={unavailable}
                    onCheckedChange={(value) =>
                      onChange(
                        value === true
                          ? [...selected, { project, role: "member" }]
                          : selected.filter(
                              (item) => item.project.id !== project.id,
                            ),
                      )
                    }
                  />
                  <FieldLabel htmlFor={`${id}-${project.id}`}>
                    {project.name}
                  </FieldLabel>
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
                  没有匹配的项目
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
          className="flex max-h-48 flex-col gap-2 overflow-y-auto overscroll-contain p-1"
          role="group"
          aria-label="已选项目"
        >
          {selected.map((item) => (
            <div
              className="flex flex-wrap items-center gap-2"
              key={item.project.id}
            >
              <span className="flex-1 truncate text-sm">{item.project.name}</span>
              <ToggleGroup
                type="single"
                variant="outline"
                value={item.role}
                disabled={disabled}
                aria-label={`${item.project.name} 的角色`}
                onValueChange={(role) => {
                  if (role)
                    onChange(
                      selected.map((x) =>
                        x.project.id === item.project.id
                          ? { ...x, role: role as ProjectRole }
                          : x,
                      ),
                    );
                }}
              >
                <ToggleGroupItem value="member">成员</ToggleGroupItem>
                <ToggleGroupItem value="admin">项目管理员</ToggleGroupItem>
              </ToggleGroup>
              <Button
                type="button"
                variant="ghost"
                disabled={disabled}
                onClick={() =>
                  onChange(
                    selected.filter((x) => x.project.id !== item.project.id),
                  )
                }
              >
                移除
              </Button>
            </div>
          ))}
        </div>
      )}
      <FieldDescription role="status">
        {selected.length > 0
          ? `已选 ${selected.length} 个项目，最多可选 100 个。`
          : "最多可选 100 个项目。"}
      </FieldDescription>
    </div>
  );
}
