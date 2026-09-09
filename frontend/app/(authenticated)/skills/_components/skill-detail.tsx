"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  FileIcon,
  FolderIcon,
  ImageIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { LoadError } from "@/components/common/load-error";
import { MarkdownContent } from "@/components/common/markdown-content";
import {
  skillsReadSkill,
  skillsReadSkillFile,
  type SkillFileNodePublic,
} from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type SkillDetailProps = {
  skillName: string;
};

type FilePreview =
  | { kind: "text"; content: string }
  | { kind: "image"; url: string }
  | { kind: "download"; url: string; contentType: string };

export function SkillDetail({ skillName }: SkillDetailProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeView =
    searchParams.get("view") === "files" ? "files" : "overview";

  const detailQuery = useQuery({
    meta: { handlesInitialError: true },
    queryKey: ["skills", "detail", skillName],
    queryFn: async ({ signal }) => {
      const { data } = await skillsReadSkill({
        path: { skill_name: skillName },
        signal,
        throwOnError: true,
      });

      return data;
    },
  });

  const detail = detailQuery.data;
  const description = detail?.frontmatter.description;

  function changeView(view: string): void {
    const parameters = new URLSearchParams(searchParams);

    if (view === "files") {
      parameters.set("view", "files");
    } else {
      parameters.delete("view");
    }

    const path = `/skills/${encodeURIComponent(skillName)}`;
    const query = parameters.toString();

    router.replace(query ? `${path}?${query}` : path, { scroll: false });
  }

  return (
    <>
      <AppHeader
        title={skillName}
        left={
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href="/skills" aria-label="返回技能列表">
              <ArrowLeftIcon aria-hidden="true" />
            </Link>
          </Button>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mx-auto flex min-h-full max-w-6xl flex-col gap-6">
          {detailQuery.isPending && <SkillDetailSkeleton />}

          {detailQuery.isError && detail === undefined && (
            <LoadError
              title="技能加载失败"
              isRetrying={detailQuery.isFetching}
              onRetry={() => void detailQuery.refetch()}
            />
          )}

          {detail && (
            <>
              {typeof description === "string" && (
                <p className="break-words text-muted-foreground">
                  {description}
                </p>
              )}

              <Tabs
                value={activeView}
                onValueChange={changeView}
                className="gap-6"
              >
                <TabsList>
                  <TabsTrigger value="overview">概述</TabsTrigger>
                  <TabsTrigger value="files">文件</TabsTrigger>
                </TabsList>

                <TabsContent value="overview">
                  <MarkdownContent>{detail.content}</MarkdownContent>
                </TabsContent>

                <TabsContent value="files">
                  <SkillFileBrowser
                    skillName={skillName}
                    nodes={detail.files}
                  />
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function SkillDetailSkeleton() {
  return (
    <div
      role="status"
      className="flex flex-col gap-4"
      aria-label="正在加载技能详情"
    >
      <Skeleton className="h-4 w-2/3 max-w-xl" />
      <div className="flex gap-2">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-20" />
      </div>
      <div className="flex max-w-4xl flex-col gap-3">
        <Skeleton className="h-7 w-2/5" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="mt-3 h-6 w-1/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}

function SkillFileBrowser({
  skillName,
  nodes,
}: {
  skillName: string;
  nodes: SkillFileNodePublic[];
}) {
  const [selectedPath, setSelectedPath] = useState<string>();
  const fileQuery = useQuery({
    meta: { handlesInitialError: true },
    queryKey: ["skills", "file", skillName, selectedPath],
    queryFn: async ({ signal }) => {
      if (!selectedPath) return undefined;

      const { data } = await skillsReadSkillFile({
        path: { skill_name: skillName, file_path: selectedPath },
        signal,
        throwOnError: true,
      });

      return data;
    },
    enabled: Boolean(selectedPath),
  });

  const [fileObjectUrl, setFileObjectUrl] = useState<{
    data: Blob;
    url: string;
  }>();

  useEffect(() => {
    const fileData = fileQuery.data;

    if (!(fileData instanceof Blob)) return;

    const url = URL.createObjectURL(fileData);
    setFileObjectUrl({ data: fileData, url });

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [fileQuery.data]);

  function readFile(path: string): void {
    setSelectedPath(path);
  }

  const fileUrl =
    fileObjectUrl && fileObjectUrl.data === fileQuery.data
      ? fileObjectUrl.url
      : undefined;
  const filePreview = getFilePreview(fileQuery.data, fileUrl);
  const fileLoading =
    Boolean(selectedPath) &&
    (fileQuery.isPending || (fileQuery.data instanceof Blob && !fileUrl));

  return (
    <div className="grid gap-4 md:grid-cols-[16rem_minmax(0,1fr)]">
      <Card className="self-start">
        <CardHeader>
          <CardTitle>文件列表</CardTitle>
        </CardHeader>
        <CardContent>
          <SkillFileTree
            nodes={nodes}
            selectedPath={selectedPath}
            onSelect={readFile}
          />
        </CardContent>
      </Card>

      <Card className="h-[80svh]">
        <CardHeader>
          <CardTitle>{selectedPath ?? "文件预览"}</CardTitle>
        </CardHeader>
        <CardContent className="min-h-0 min-w-0 flex-1 overflow-auto">
          <FilePreviewContent
            path={selectedPath}
            preview={filePreview}
            loading={fileLoading}
            error={fileQuery.isError && fileQuery.data === undefined}
            retrying={fileQuery.isFetching}
            onRetry={() => void fileQuery.refetch()}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function SkillFileTree({
  nodes,
  selectedPath,
  onSelect,
}: {
  nodes: SkillFileNodePublic[];
  selectedPath: string | undefined;
  onSelect: (path: string) => void;
}) {
  if (nodes.length === 0) {
    return (
      <Empty className="p-4 md:p-4">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>暂无文件</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      {nodes.map((node) => (
        <SkillFileTreeNode
          key={node.path}
          node={node}
          selectedPath={selectedPath}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function SkillFileTreeNode({
  node,
  selectedPath,
  onSelect,
}: {
  node: SkillFileNodePublic;
  selectedPath: string | undefined;
  onSelect: (path: string) => void;
}) {
  if (node.type === "file") {
    return (
      <Button
        variant={selectedPath === node.path ? "secondary" : "ghost"}
        size="sm"
        className="w-full justify-start"
        onClick={() => onSelect(node.path)}
      >
        <FileIcon data-icon="inline-start" />
        <span className="truncate">{node.name}</span>
      </Button>
    );
  }

  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="group w-full justify-start"
        >
          <ChevronRightIcon
            data-icon="inline-start"
            className="group-data-[state=open]:rotate-90"
          />
          <FolderIcon data-icon="inline-start" />
          <span className="truncate">{node.name}</span>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="ms-4">
        <SkillFileTree
          nodes={node.children ?? []}
          selectedPath={selectedPath}
          onSelect={onSelect}
        />
      </CollapsibleContent>
    </Collapsible>
  );
}

function getFilePreview(
  data: unknown,
  fileUrl?: string,
): FilePreview | undefined {
  if (typeof data === "string") {
    return { kind: "text", content: data };
  }

  if (data instanceof Blob) {
    if (!fileUrl) return undefined;

    return data.type.startsWith("image/")
      ? { kind: "image", url: fileUrl }
      : { kind: "download", url: fileUrl, contentType: data.type };
  }

  if (data === undefined) return undefined;

  return {
    kind: "text",
    content: JSON.stringify(data, null, 2) ?? String(data),
  };
}

function FilePreviewContent({
  path,
  preview,
  loading,
  error,
  retrying,
  onRetry,
}: {
  path: string | undefined;
  preview: FilePreview | undefined;
  loading: boolean;
  error: boolean;
  retrying: boolean;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <div
        role="status"
        aria-label="正在加载文件"
        className="flex h-full w-full flex-col gap-3"
      >
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }

  if (error) {
    return (
      <LoadError title="文件加载失败" isRetrying={retrying} onRetry={onRetry} />
    );
  }

  if (path && !preview)
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>暂无文件内容</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );

  if (preview?.kind === "text") {
    return (
      <pre className="whitespace-pre-wrap break-words text-sm">
        {preview.content}
      </pre>
    );
  }

  if (preview?.kind === "image") {
    return (
      <img
        src={preview.url}
        alt={path ?? "技能文件"}
        className="max-h-full max-w-full object-contain"
      />
    );
  }

  if (preview?.kind === "download") {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <DownloadIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>{path}</EmptyTitle>
          <EmptyDescription>{preview.contentType}</EmptyDescription>
        </EmptyHeader>
        <Button asChild>
          <a href={preview.url} download={path?.split("/").pop()}>
            <DownloadIcon data-icon="inline-start" />
            下载文件
          </a>
        </Button>
      </Empty>
    );
  }

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ImageIcon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>选择文件</EmptyTitle>
        <EmptyDescription>从左侧列表中选择要预览的文件。</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
