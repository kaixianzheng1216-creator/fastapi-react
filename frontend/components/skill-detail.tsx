"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  FileIcon,
  FolderIcon,
  ImageIcon,
} from "lucide-react";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { MarkdownContent } from "@/components/markdown-text";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  skillsReadSkill,
  skillsReadSkillFile,
  type SkillFileNodePublic,
} from "@/lib/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  const {
    data: detail,
    error,
    isPending: detailLoading,
  } = useQuery({
    queryKey: ["skills", "detail", skillName],
    queryFn: async ({ signal }) => {
      const { data } = await skillsReadSkill({
        path: { skill_name: skillName },
        signal,
        throwOnError: true,
      });

      return data;
    },
    retry: false,
  });

  const detailError = error
    ? getApiErrorMessage(error, "读取技能详情失败")
    : "";

  const description = detail?.frontmatter.description;

  return (
    <>
      <AppHeader title={skillName} />

      <div className="min-h-0 flex-1 overflow-y-scroll">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 p-4 md:p-8">
          <Link
            href="/skills"
            className="flex items-center gap-2 self-start text-sm"
          >
            <ArrowLeftIcon className="size-4" />
            返回技能
          </Link>

          {detailLoading && <SkillDetailSkeleton />}

          {detailError && (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>无法读取技能</AlertTitle>
              <AlertDescription>
                <p>{detailError}</p>
                <Button asChild variant="outline" size="sm">
                  <Link href="/skills">返回技能列表</Link>
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {detail && (
            <>
              <section className="flex flex-col gap-2">
                <h2 className="text-2xl font-semibold">{skillName}</h2>
                {typeof description === "string" && (
                  <p className="break-words text-muted-foreground">
                    {description}
                  </p>
                )}
              </section>

              <Tabs defaultValue="overview" className="gap-6">
                <TabsList variant="line">
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
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-64 w-full" />
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
  const [filePreview, setFilePreview] = useState<FilePreview>();
  const [fileError, setFileError] = useState("");
  const [fileLoading, setFileLoading] = useState(false);
  const fileRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      fileRequest.current?.abort();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (filePreview?.kind === "image" || filePreview?.kind === "download") {
        URL.revokeObjectURL(filePreview.url);
      }
    };
  }, [filePreview]);

  async function readFile(path: string): Promise<void> {
    fileRequest.current?.abort();
    const controller = new AbortController();
    fileRequest.current = controller;

    setSelectedPath(path);
    setFilePreview(undefined);
    setFileError("");
    setFileLoading(true);

    try {
      const { data } = await skillsReadSkillFile({
        path: { skill_name: skillName, file_path: path },
        signal: controller.signal,
        throwOnError: true,
      });

      if (controller.signal.aborted) {
        return;
      }

      if (typeof data === "string") {
        setFilePreview({ kind: "text", content: data });

        return;
      }

      if (data instanceof Blob) {
        const url = URL.createObjectURL(data);

        if (data.type.startsWith("image/")) {
          setFilePreview({ kind: "image", url });
        } else {
          setFilePreview({
            kind: "download",
            url,
            contentType: data.type,
          });
        }

        return;
      }

      setFilePreview({
        kind: "text",
        content: JSON.stringify(data, null, 2) ?? String(data),
      });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setFileError(getApiErrorMessage(error, "读取文件失败"));
      }
    } finally {
      if (!controller.signal.aborted) {
        setFileLoading(false);
      }
    }
  }

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
            error={fileError}
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

function FilePreviewContent({
  path,
  preview,
  loading,
  error,
}: {
  path: string | undefined;
  preview: FilePreview | undefined;
  loading: boolean;
  error: string;
}) {
  if (loading) {
    return (
      <Skeleton
        role="status"
        className="h-full w-full"
        aria-label="正在加载文件"
      />
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircleIcon />
        <AlertTitle>无法读取文件</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

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
            <DownloadIcon />
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
          <ImageIcon />
        </EmptyMedia>
        <EmptyTitle>选择文件</EmptyTitle>
        <EmptyDescription>从左侧列表中选择要预览的文件。</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
