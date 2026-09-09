"use client";

import { type FormEvent, useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { PlusIcon, PuzzleIcon, TrashIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { DeleteDialog } from "@/components/common/delete-dialog";
import { Button } from "@/components/ui/button";
import { LoadError } from "@/components/common/load-error";
import { PageOutOfRange } from "@/components/common/page-out-of-range";
import { PagePagination } from "@/components/common/page-pagination";
import { SearchToolbar } from "@/components/common/search-toolbar";
import {
  ResourceCard,
  ResourceCardsSkeleton,
} from "@/components/common/resource-card";
import {
  CARD_PAGE_SIZE,
  CardGrid,
} from "@/components/common/collection-content";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { AppHeader } from "@/components/layout/app-header";
import { ThreadListPopover } from "@/app/(authenticated)/_components/thread-list-popover";
import { getApiErrorMessage } from "@/lib/api-error";
import { getPaginationHref, parsePage } from "@/lib/pagination";
import {
  skillsDeleteSkill,
  skillsReadSkills,
  type SkillSummaryPublic,
} from "@/lib/client";
import { SkillCreateDialog } from "@/app/(authenticated)/skills/_components/skill-create-dialog";
import { toast } from "sonner";

const SKILLS_QUERY_KEY = ["skills"] as const;

export function SkillManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const currentPage = parsePage(searchParams.get("page"));
  const searchQuery = searchParams.get("search")?.trim() || undefined;
  const offset = (currentPage - 1) * CARD_PAGE_SIZE;

  const skillsQuery = useQuery({
    meta: { handlesInitialError: true },
    queryKey: [...SKILLS_QUERY_KEY, offset, searchQuery],
    queryFn: async ({ signal }) => {
      const { data } = await skillsReadSkills({
        query: { offset, limit: CARD_PAGE_SIZE, search: searchQuery },
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
  const totalPages = Math.ceil(count / CARD_PAGE_SIZE);
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
      toast.error(getApiErrorMessage(error, "技能删除失败，请重试"));
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
        <section className="mx-auto flex min-h-full max-w-6xl flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SearchToolbar
              id="skill-search"
              label="搜索技能"
              placeholder="搜索名称或描述…"
              onSubmit={searchSkills}
              key={searchQuery}
              defaultValue={searchQuery}
              maxLength={100}
            />
          </div>

          {skillsQuery.isPending ? (
            <ResourceCardsSkeleton />
          ) : skillsQuery.isError && skillsQuery.data === undefined ? (
            <LoadError
              title="技能加载失败"
              isRetrying={skillsQuery.isFetching}
              onRetry={() => void skillsQuery.refetch()}
            />
          ) : skills.length === 0 ? (
            pageOutOfRange ? (
              <PageOutOfRange href={getSkillsHref(1, searchQuery)} />
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <PuzzleIcon aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyTitle>
                    {searchQuery ? "未找到符合条件的技能" : "暂无技能"}
                  </EmptyTitle>
                </EmptyHeader>
              </Empty>
            )
          ) : (
            <CardGrid busy={skillsQuery.isFetching} label="技能列表">
              {skills.map((skill) => (
                <li key={skill.name} className="min-w-0">
                  <ResourceCard
                    name={skill.name}
                    description={skill.description}
                    href={`/skills/${skill.name}`}
                    icon={PuzzleIcon}
                    actions={
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => {
                          setSkillToDelete(skill);
                        }}
                      >
                        <TrashIcon aria-hidden="true" />
                        删除
                      </DropdownMenuItem>
                    }
                  />
                </li>
              ))}
            </CardGrid>
          )}

          <PagePagination
            className="mt-auto"
            ariaLabel="技能分页"
            currentPage={currentPage}
            pageCount={totalPages}
            getPageHref={(page) => getSkillsHref(page, searchQuery)}
          />
        </section>
      </div>

      <SkillCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCreated}
      />

      <DeleteDialog
        open={skillToDelete !== undefined}
        pending={deleteSkillMutation.isPending}
        title="删除技能"
        onOpenChange={(open) => {
          if (!open) setSkillToDelete(undefined);
        }}
        onConfirm={() => {
          if (skillToDelete) deleteSkillMutation.mutate(skillToDelete.name);
        }}
      >
        将永久删除“{skillToDelete?.name}”及其所有文件，此操作无法撤销。
      </DeleteDialog>
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
