"use client";

import { ThreadListPopover } from "@/app/(authenticated)/_components/thread-list-popover";
import { SkillCreateDialog } from "@/app/(authenticated)/skills/_components/skill-create-dialog";
import {
  CARD_PAGE_SIZE,
  CardGrid,
} from "@/components/common/collection-content";
import { DeleteDialog } from "@/components/common/delete-dialog";
import { LoadError } from "@/components/common/load-error";
import { PagePagination } from "@/components/common/page-pagination";
import {
  ResourceCard,
  ResourceCardsSkeleton,
} from "@/components/common/resource-card";
import { SearchToolbar } from "@/components/common/search-toolbar";
import { AppHeader } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useListParams } from "@/hooks/use-list-params";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  skillsDeleteSkill,
  skillsReadSkills,
  type SkillSummaryPublic,
} from "@/lib/client";
import { getPaginationHref, parsePage } from "@/lib/pagination";
import { getQueryViewState } from "@/lib/query-view-state";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { PlusIcon, PuzzleIcon, TrashIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

const SKILLS_QUERY_KEY = ["skills"] as const;

export function SkillManager() {
  const router = useRouter();
  const { params: searchParams, update } = useListParams();
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
  const viewState = getQueryViewState(
    skillsQuery,
    skillsQuery.data?.data.length === 0,
  );

  function invalidateSkills(): void {
    void queryClient.invalidateQueries({ queryKey: SKILLS_QUERY_KEY });
  }

  const skills = skillsQuery.data?.data ?? [];
  const count = skillsQuery.data?.count ?? 0;
  const totalPages = Math.ceil(count / CARD_PAGE_SIZE);

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
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "技能删除失败，请重试"));
    },
  });

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
              isPending={skillsQuery.isFetching}
              label="搜索技能"
              placeholder="搜索名称或描述…"
              onSearch={(value) => {
                if (value === (searchQuery ?? "")) void skillsQuery.refetch();
                else update({ search: value });
              }}
              value={searchQuery ?? ""}
              maxLength={100}
            />
          </div>

          {viewState === "loading" ? (
            <ResourceCardsSkeleton />
          ) : viewState === "error" ? (
            <LoadError
              title="技能加载失败"
              isRetrying={skillsQuery.isFetching}
              onRetry={() => void skillsQuery.refetch()}
            />
          ) : skills.length === 0 ? (
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
          ) : (
            <CardGrid
              inert={viewState === "ready" && skillsQuery.isPlaceholderData}
              busy={skillsQuery.isFetching}
              label="技能列表"
            >
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
            pending={
              skillsQuery.data === undefined || skillsQuery.isPlaceholderData
            }
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
