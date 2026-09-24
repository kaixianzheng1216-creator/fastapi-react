"use client";

import { useState, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { useDebouncedCallback } from "use-debounce";

import { projectsReadProjects, type ProjectPublic } from "@/lib/client";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";

export function ProjectPicker({
  current,
  onSelect,
}: {
  current?: ProjectPublic;
  onSelect: (project: ProjectPublic) => void;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const composing = useRef(false);
  const searchLater = useDebouncedCallback(
    (value: string) => setSearch(value.trim()),
    300,
  );

  const changeInput = (value: string) => {
    setInput(value);
    if (!composing.current) searchLater(value);
  };

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

  function changeOpen(value: boolean) {
    setOpen(value);
    if (!value) {
      searchLater.cancel();
      composing.current = false;
      setInput("");
      setSearch("");
    }
  }

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between"
          role="combobox"
          aria-expanded={open}
          aria-label="选择项目"
        >
          <span className="truncate">{current?.name ?? "选择项目"}</span>
          <ChevronsUpDownIcon data-icon="inline-end" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="搜索项目…"
            value={input}
            onValueChange={changeInput}
            onCompositionStart={() => {
              composing.current = true;
              searchLater.cancel();
            }}
            onCompositionEnd={(event) => {
              composing.current = false;
              searchLater(event.currentTarget.value);
            }}
          />
          <CommandList>
            <CommandGroup>
              {items.map((project) => (
                <CommandItem
                  key={project.id}
                  value={project.id}
                  onSelect={() => {
                    onSelect(project);
                    changeOpen(false);
                  }}
                >
                  <span className="flex-1 truncate">{project.name}</span>
                  {current?.id === project.id && <CheckIcon />}
                </CommandItem>
              ))}
              {query.isPending ? (
                <CommandItem disabled>正在加载…</CommandItem>
              ) : query.isError ? (
                <CommandItem onSelect={() => void query.refetch()}>
                  加载失败，点击重试
                </CommandItem>
              ) : (
                !items.length && (
                  <CommandItem disabled>没有匹配的项目</CommandItem>
                )
              )}
              {query.hasNextPage && (
                <CommandItem
                  disabled={query.isFetchingNextPage}
                  onSelect={() => void query.fetchNextPage()}
                >
                  加载更多
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
