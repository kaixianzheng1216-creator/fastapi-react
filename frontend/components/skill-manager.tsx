"use client";

import { type SubmitEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircleIcon,
  MoreHorizontalIcon,
  PlusIcon,
  SearchIcon,
  SparklesIcon,
  TrashIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { AppHeader } from "@/components/app-header";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  skillsDeleteSkill,
  skillsReadSkills,
  type SkillSummaryPublic,
} from "@/lib/client";
import { SkillCreateDialog } from "@/components/skill-create-dialog";

const PAGE_SIZE = 12;
const SKILLS_QUERY_KEY = ["skills"] as const;
const ELLIPSIS = "ellipsis" as const;

type PaginationPage = number | typeof ELLIPSIS;

export function SkillManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const pageParameter = Number(searchParams.get("page"));
  const currentPage =
    Number.isInteger(pageParameter) && pageParameter > 0 ? pageParameter : 1;
  const searchQuery = searchParams.get("search")?.trim() || undefined;
  const offset = (currentPage - 1) * PAGE_SIZE;

  const [searchDraft, setSearchDraft] = useState(searchQuery ?? "");

  useEffect(() => {
    setSearchDraft(searchQuery ?? "");
  }, [searchQuery]);

  const {
    data: skillsResponse,
    error: loadError,
    isPending: isLoading,
    refetch,
  } = useQuery({
    queryKey: [...SKILLS_QUERY_KEY, offset, searchQuery],
    queryFn: async ({ signal }) => {
      const { data } = await skillsReadSkills({
        query: { offset, limit: PAGE_SIZE, search: searchQuery },
        signal,
        throwOnError: true,
      });

      return data;
    },
    retry: false,
  });

  function invalidateSkills(): void {
    void queryClient.invalidateQueries({ queryKey: SKILLS_QUERY_KEY });
  }

  const skills = skillsResponse?.data ?? [];
  const count = skillsResponse?.count ?? 0;
  const loadErrorMessage = loadError
    ? getApiErrorMessage(loadError, "读取技能列表失败")
    : "";
  const totalPages = Math.ceil(count / PAGE_SIZE);
  const paginationPages = getPaginationPages(currentPage, totalPages);

  const [createOpen, setCreateOpen] = useState(false);
  const [skillToDelete, setSkillToDelete] = useState<SkillSummaryPublic>();

  const {
    error: deleteError,
    isPending: deleting,
    mutate: deleteSkill,
    reset: resetDelete,
  } = useMutation({
    mutationFn: async (skillName: string) => {
      await skillsDeleteSkill({
        path: { skill_name: skillName },
        throwOnError: true,
      });
    },
    onSuccess: () => {
      setSkillToDelete(undefined);
      invalidateSkills();

      if (skills.length === 1 && offset > 0) {
        router.replace(getSkillsHref(currentPage - 1, searchQuery));
      }
    },
  });

  const deleteErrorMessage = deleteError
    ? getApiErrorMessage(deleteError, "删除技能失败")
    : "";

  function searchSkills(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    const nextSearchQuery = searchDraft.trim();

    router.push(getSkillsHref(1, nextSearchQuery || undefined));
  }

  function clearSearch(): void {
    setSearchDraft("");
    router.push("/skills");
  }

  function handleCreated(): void {
    clearSearch();
    invalidateSkills();
  }

  function confirmDelete(): void {
    if (!skillToDelete) {
      return;
    }

    deleteSkill(skillToDelete.name);
  }

  return (
    <>
      <AppHeader
        title="技能"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <PlusIcon data-icon="inline-start" />
            创建技能
          </Button>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-scroll">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 p-4 md:p-8">
          <form onSubmit={searchSkills}>
            <FieldGroup>
              <Field orientation="responsive">
                <FieldLabel htmlFor="skill-search" className="sr-only">
                  搜索技能
                </FieldLabel>
                <Input
                  id="skill-search"
                  type="search"
                  value={searchDraft}
                  onChange={(event) => {
                    const value = event.target.value;

                    if (value) {
                      setSearchDraft(value);

                      return;
                    }

                    clearSearch();
                  }}
                  maxLength={100}
                  autoComplete="off"
                  placeholder="搜索名称或描述…"
                  className="flex-1"
                />
                <Button type="submit">
                  <SearchIcon data-icon="inline-start" />
                  搜索
                </Button>
              </Field>
            </FieldGroup>
          </form>

          {loadErrorMessage && (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>无法读取技能</AlertTitle>
              <AlertDescription>
                <p>{loadErrorMessage}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void refetch()}
                >
                  重试
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {isLoading && <SkillGridSkeleton />}

          {!isLoading && !loadErrorMessage && skills.length === 0 && (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SparklesIcon />
                </EmptyMedia>
                <EmptyTitle>
                  {searchQuery ? "没有匹配的技能" : "还没有技能"}
                </EmptyTitle>
                <EmptyDescription>
                  {searchQuery
                    ? "尝试其他关键词，或者清除搜索条件。"
                    : "创建新技能，或从 ZIP 压缩包导入。"}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                {searchQuery ? (
                  <Button variant="outline" onClick={clearSearch}>
                    清除搜索
                  </Button>
                ) : (
                  <Button onClick={() => setCreateOpen(true)}>
                    <PlusIcon data-icon="inline-start" />
                    创建技能
                  </Button>
                )}
              </EmptyContent>
            </Empty>
          )}

          {!isLoading && !loadErrorMessage && skills.length > 0 && (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {skills.map((skill) => (
                  <Card key={skill.name} className="relative">
                    <Link
                      href={`/skills/${skill.name}`}
                      aria-label={`查看技能 ${skill.name}`}
                      className="absolute inset-0"
                    />
                    <CardHeader>
                      <CardTitle className="truncate">{skill.name}</CardTitle>
                      <CardDescription className="min-h-10 line-clamp-2 break-all">
                        {skill.description}
                      </CardDescription>
                      <CardAction className="relative z-10">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`${skill.name} 的更多操作`}
                            >
                              <MoreHorizontalIcon />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuGroup>
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => {
                                  resetDelete();
                                  setSkillToDelete(skill);
                                }}
                              >
                                <TrashIcon />
                                删除
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </CardAction>
                    </CardHeader>
                  </Card>
                ))}
              </div>

              <Pagination className="mt-4" aria-label="技能分页">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href={getSkillsHref(
                        Math.max(1, currentPage - 1),
                        searchQuery,
                      )}
                      aria-label="转到上一页"
                      aria-disabled={currentPage === 1}
                      tabIndex={currentPage === 1 ? -1 : undefined}
                      className="aria-disabled:pointer-events-none aria-disabled:opacity-50"
                    />
                  </PaginationItem>

                  {paginationPages.map((page, index) => (
                    <PaginationItem key={`${page}-${index}`}>
                      {page === ELLIPSIS ? (
                        <PaginationEllipsis />
                      ) : (
                        <PaginationLink
                          href={getSkillsHref(page, searchQuery)}
                          isActive={page === currentPage}
                        >
                          {page}
                        </PaginationLink>
                      )}
                    </PaginationItem>
                  ))}

                  <PaginationItem>
                    <PaginationNext
                      href={getSkillsHref(
                        Math.min(totalPages, currentPage + 1),
                        searchQuery,
                      )}
                      aria-label="转到下一页"
                      aria-disabled={currentPage === totalPages}
                      tabIndex={currentPage === totalPages ? -1 : undefined}
                      className="aria-disabled:pointer-events-none aria-disabled:opacity-50"
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </>
          )}
        </div>
      </div>

      <SkillCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCreated}
      />

      <AlertDialog
        open={skillToDelete !== undefined}
        onOpenChange={(open) => {
          if (!open && !deleting) {
            setSkillToDelete(undefined);
            resetDelete();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除技能？</AlertDialogTitle>
            <AlertDialogDescription>
              将永久删除“{skillToDelete?.name}”及其所有文件，此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deleteErrorMessage && (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>删除失败</AlertTitle>
              <AlertDescription>{deleteErrorMessage}</AlertDescription>
            </Alert>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                confirmDelete();
              }}
            >
              {deleting && <Spinner data-icon="inline-start" />}
              删除技能
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function getSkillsHref(page: number, search?: string): string {
  const parameters = new URLSearchParams();

  if (page > 1) {
    parameters.set("page", String(page));
  }

  if (search) {
    parameters.set("search", search);
  }

  const query = parameters.toString();

  return query ? `/skills?${query}` : "/skills";
}

function getPaginationPages(
  currentPage: number,
  totalPages: number,
): PaginationPage[] {
  if (totalPages <= 7) {
    const pages: number[] = [];

    for (let page = 1; page <= totalPages; page += 1) {
      pages.push(page);
    }

    return pages;
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, ELLIPSIS, totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [
      1,
      ELLIPSIS,
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }

  return [
    1,
    ELLIPSIS,
    currentPage - 1,
    currentPage,
    currentPage + 1,
    ELLIPSIS,
    totalPages,
  ];
}

function SkillGridSkeleton() {
  return (
    <div
      role="status"
      className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
      aria-label="正在加载技能"
    >
      {Array.from({ length: 6 }, (_, index) => (
        <Card key={index}>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-10 w-full" />
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}
