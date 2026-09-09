"use client";

import { type FormEvent, useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  MoreHorizontalIcon,
  PlusIcon,
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
import { Button } from "@/components/ui/button";
import { PageOutOfRange } from "@/components/shared/page-out-of-range";
import { PagePagination } from "@/components/shared/page-pagination";
import { SearchToolbar } from "@/components/shared/search-toolbar";
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
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { AppHeader } from "@/components/layout/app-header";
import { ThreadListPopover } from "@/app/(authenticated)/_components/thread-list-popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { getApiErrorMessage } from "@/lib/api-error";
import { getPaginationHref, parsePage } from "@/lib/pagination";
import {
  skillsDeleteSkill,
  skillsReadSkills,
  type SkillSummaryPublic,
} from "@/lib/client";
import { SkillCreateDialog } from "@/app/(authenticated)/skills/_components/skill-create-dialog";
import { toast } from "sonner";

const PAGE_SIZE = 12;
const SKILLS_QUERY_KEY = ["skills"] as const;

export function SkillManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const currentPage = parsePage(searchParams.get("page"));
  const searchQuery = searchParams.get("search")?.trim() || undefined;
  const offset = (currentPage - 1) * PAGE_SIZE;

  const skillsQuery = useQuery({
    queryKey: [...SKILLS_QUERY_KEY, offset, searchQuery],
    queryFn: async ({ signal }) => {
      const { data } = await skillsReadSkills({
        query: { offset, limit: PAGE_SIZE, search: searchQuery },
        signal,
        throwOnError: true,
      });

      return data;
    },
    placeholderData: keepPreviousData,
  });

  function invalidateSkills(): void {
    void queryClient.invalidateQueries({ queryKey: SKILLS_QUERY_KEY });
  }

  const skills = skillsQuery.data?.data ?? [];
  const count = skillsQuery.data?.count ?? 0;
  const totalPages = Math.ceil(count / PAGE_SIZE);
  const pageOutOfRange = count > 0 && skills.length === 0;

  const [createOpen, setCreateOpen] = useState(false);
  const [skillToDelete, setSkillToDelete] = useState<SkillSummaryPublic>();

  const deleteSkillMutation = useMutation({
    mutationFn: async (skillName: string) => {
      await skillsDeleteSkill({
        path: { skill_name: skillName },
        throwOnError: true,
      });
    },
    onSuccess: () => {
      toast.success("技能已删除");
      setSkillToDelete(undefined);
      invalidateSkills();

      if (skills.length === 1 && offset > 0) {
        router.replace(getSkillsHref(currentPage - 1, searchQuery));
      }
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "删除技能失败，请重试"));
    },
  });

  function searchSkills(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const nextSearchQuery = String(formData.get("search") ?? "").trim();

    router.push(getSkillsHref(1, nextSearchQuery || undefined));
  }

  function clearSearch(): void {
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

    deleteSkillMutation.mutate(skillToDelete.name);
  }

  return (
    <>
      <AppHeader
        title="技能"
        left={<ThreadListPopover />}
        actions={
          <Button aria-label="创建技能" onClick={() => setCreateOpen(true)}>
            <PlusIcon data-icon="inline-start" aria-hidden="true" />
            <span className="hidden sm:inline">创建技能</span>
          </Button>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mx-auto flex min-h-full max-w-6xl flex-col gap-6">
          <SearchToolbar
            id="skill-search"
            label="搜索技能"
            placeholder="搜索名称或描述…"
            onSubmit={searchSkills}
            key={searchQuery}
            defaultValue={searchQuery}
            maxLength={100}
          />

          {skillsQuery.isPending && <SkillGridSkeleton />}
          {!skillsQuery.isPending &&
            skills.length === 0 &&
            (pageOutOfRange ? (
              <PageOutOfRange href={getSkillsHref(1, searchQuery)} />
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>暂无可显示内容</EmptyTitle>
                </EmptyHeader>
              </Empty>
            ))}

          {!skillsQuery.isPending && skills.length > 0 && (
            <>
              <div
                aria-busy={skillsQuery.isFetching}
                className="grid gap-4 transition-opacity aria-busy:pointer-events-none aria-busy:opacity-60 md:grid-cols-2 xl:grid-cols-3"
              >
                {skills.map((skill) => (
                  <Card key={skill.name} className="relative">
                    <Link
                      href={`/skills/${skill.name}`}
                      aria-label={`查看技能 ${skill.name}`}
                      className="absolute inset-0 rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
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

              <PagePagination
                className="mt-auto"
                ariaLabel="技能分页"
                currentPage={currentPage}
                pageCount={totalPages}
                getPageHref={(page) => getSkillsHref(page, searchQuery)}
              />
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
          if (!open && !deleteSkillMutation.isPending) {
            setSkillToDelete(undefined);
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

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSkillMutation.isPending}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteSkillMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                confirmDelete();
              }}
            >
              {deleteSkillMutation.isPending && (
                <Spinner data-icon="inline-start" />
              )}
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

  if (search) {
    parameters.set("search", search);
  }

  return getPaginationHref("/skills", page, parameters);
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
            <Skeleton className="h-10" />
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}
