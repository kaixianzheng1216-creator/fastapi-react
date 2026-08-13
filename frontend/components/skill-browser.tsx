"use client";

import {
  ChevronRightIcon,
  FileIcon,
  FolderIcon,
  FolderOpenIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getAccessToken } from "@/lib/auth";
import {
  type SkillFileNodePublic,
  type SkillPublic,
  type SkillSummaryPublic,
  skillsReadSkill,
  skillsReadSkills,
} from "@/lib/client";

export function SkillBrowser() {
  const [skills, setSkills] = useState<SkillSummaryPublic[]>();
  const [details, setDetails] = useState<Record<string, SkillPublic>>({});
  const [detailErrors, setDetailErrors] = useState<Set<string>>(new Set());
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    const accessToken = getAccessToken();

    if (!accessToken) return;

    void skillsReadSkills({
      auth: accessToken,
      throwOnError: true,
    })
      .then(({ data }) => setSkills(data))
      .catch(() => setLoadFailed(true));
  }, []);

  async function loadSkill(skillName: string, open: boolean): Promise<void> {
    if (!open || details[skillName]) return;

    const accessToken = getAccessToken();

    if (!accessToken) return;

    setDetailErrors((currentErrors) => {
      const nextErrors = new Set(currentErrors);
      nextErrors.delete(skillName);
      return nextErrors;
    });

    try {
      const { data } = await skillsReadSkill({
        auth: accessToken,
        path: { skill_name: skillName },
        throwOnError: true,
      });

      setDetails((currentDetails) => ({
        ...currentDetails,
        [skillName]: data,
      }));
    } catch {
      setDetailErrors((currentErrors) => {
        const nextErrors = new Set(currentErrors);
        nextErrors.add(skillName);
        return nextErrors;
      });
    }
  }

  return (
    <main className="min-h-0 flex-1 overflow-y-auto p-6 md:p-10">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <div>
          <h2 className="text-lg font-semibold">我的 Skills</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            展开 Skill 查看其中的文件结构。
          </p>
        </div>

        {loadFailed && (
          <p className="text-destructive text-sm">
            无法加载 Skills，请稍后重试。
          </p>
        )}

        {!loadFailed && skills === undefined && <SkillListSkeleton />}

        {skills?.length === 0 && (
          <div className="flex min-h-64 items-center justify-center rounded-lg border border-dashed">
            <p className="text-muted-foreground text-sm">还没有创建 Skill。</p>
          </div>
        )}

        {skills && skills.length > 0 && (
          <div className="overflow-hidden rounded-lg border">
            {skills.map((skill) => (
              <SkillTreeRoot
                key={skill.name}
                skill={skill}
                detail={details[skill.name]}
                loadFailed={detailErrors.has(skill.name)}
                onOpenChange={(open) => void loadSkill(skill.name, open)}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function SkillTreeRoot({
  skill,
  detail,
  loadFailed,
  onOpenChange,
}: {
  skill: SkillSummaryPublic;
  detail?: SkillPublic;
  loadFailed: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Collapsible
      onOpenChange={onOpenChange}
      className="group border-b last:border-b-0"
    >
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="h-auto w-full justify-start rounded-none px-4 py-3 text-start"
        >
          <ChevronRightIcon className="transition-transform group-data-[state=open]:rotate-90" />
          <FolderIcon className="group-data-[state=open]:hidden" />
          <FolderOpenIcon className="hidden group-data-[state=open]:block" />
          <span className="min-w-0">
            <span className="block truncate">{skill.name}</span>
            <span className="text-muted-foreground block truncate text-xs font-normal">
              {skill.description}
            </span>
          </span>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t px-4 py-2">
          {!detail && !loadFailed && <SkillTreeLoading />}
          {loadFailed && (
            <p className="text-destructive px-7 py-2 text-sm">
              无法加载文件树。
            </p>
          )}
          {detail?.files.map((node) => (
            <SkillTreeNode key={node.path} node={node} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function SkillTreeNode({ node }: { node: SkillFileNodePublic }) {
  if (node.type === "file") {
    return (
      <div className="text-muted-foreground flex h-8 items-center gap-2 px-2 text-sm">
        <FileIcon className="size-4" />
        <span className="truncate">{node.name}</span>
      </div>
    );
  }

  return (
    <Collapsible defaultOpen>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="group/folder w-full justify-start px-2 font-normal"
        >
          <ChevronRightIcon className="transition-transform group-data-[state=open]/folder:rotate-90" />
          <FolderIcon />
          <span className="truncate">{node.name}</span>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-5">
        {node.children?.map((child) => (
          <SkillTreeNode key={child.path} node={child} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function SkillListSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="size-5" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-64 max-w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function SkillTreeLoading() {
  return (
    <div className="flex flex-col gap-2 px-7 py-2">
      <Skeleton className="h-3 w-32" />
      <Skeleton className="h-3 w-48" />
    </div>
  );
}
