"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  DownloadIcon,
  FileTextIcon,
  MoreHorizontalIcon,
  RefreshCwIcon,
  SearchIcon,
  TrashIcon,
  UploadIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";

import { AppHeader } from "@/components/app-header";
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
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  type KnowledgeDocumentPublic,
  knowledgeBasesCreateDocumentUpload,
  knowledgeBasesReadDocuments,
  knowledgeBasesReadKnowledgeBase,
  knowledgeBasesSearchKnowledgeBase,
  knowledgeDocumentsCompleteDocumentUpload,
  knowledgeDocumentsDeleteDocument,
  knowledgeDocumentsRetryDocument,
} from "@/lib/client";
import {
  downloadMarkdownKnowledgeDocument,
  downloadOriginalKnowledgeDocument,
} from "@/lib/knowledge-document-download";
import {
  KNOWLEDGE_CONTENT_TYPES,
  MAX_FILE_COUNT,
  MAX_FILE_SIZE,
} from "@/lib/file-types";
import {
  getPaginationHref,
  getPaginationPages,
  PAGINATION_ELLIPSIS,
} from "@/lib/pagination";

const PAGE_SIZE = 20;
const DOCUMENTS_QUERY_KEY = "knowledge-documents";
const KNOWLEDGE_ACCEPT = KNOWLEDGE_CONTENT_TYPES.join(",");
const PENDING_POLL_WINDOW_MS = 30 * 60 * 1000;

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
});

const sizeFormatter = new Intl.NumberFormat("zh-CN", {
  maximumFractionDigits: 1,
});

const scoreFormatter = new Intl.NumberFormat("zh-CN", {
  maximumFractionDigits: 3,
});

const statusLabels: Record<KnowledgeDocumentPublic["status"], string> = {
  pending: "等待处理",
  processing: "处理中",
  ready: "可用",
  failed: "失败",
  timed_out: "已超时",
};

type KnowledgeBaseDetailProps = {
  knowledgeBaseId: string;
};

export function KnowledgeBaseDetail({
  knowledgeBaseId,
}: KnowledgeBaseDetailProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const pageParameter = Number(searchParams.get("page"));
  const currentPage =
    Number.isInteger(pageParameter) && pageParameter > 0 ? pageParameter : 1;
  const pageIndex = currentPage - 1;

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const hasTooManyFiles = selectedFiles.length > MAX_FILE_COUNT;
  const [documentToDelete, setDocumentToDelete] =
    useState<KnowledgeDocumentPublic>();

  const knowledgeBaseQuery = useQuery({
    queryKey: ["knowledge-base", knowledgeBaseId],
    queryFn: async ({ signal }) => {
      const { data } = await knowledgeBasesReadKnowledgeBase({
        path: { knowledge_base_id: knowledgeBaseId },
        signal,
        throwOnError: true,
      });

      return data;
    },
    retry: false,
  });

  const documentsQuery = useQuery({
    queryKey: [DOCUMENTS_QUERY_KEY, knowledgeBaseId, pageIndex],
    queryFn: async ({ signal }) => {
      const { data } = await knowledgeBasesReadDocuments({
        path: { knowledge_base_id: knowledgeBaseId },
        query: { skip: pageIndex * PAGE_SIZE, limit: PAGE_SIZE },
        signal,
        throwOnError: true,
      });

      return data;
    },
    refetchInterval: (query) =>
      query.state.data?.data.some(
        (document) =>
          document.status === "processing" ||
          (document.status === "pending" &&
            new Date(document.created_at).getTime() >
              Date.now() - PENDING_POLL_WINDOW_MS),
      )
        ? 3000
        : false,
    retry: false,
  });

  const uploadDocument = useMutation({
    mutationFn: async (files: File[]): Promise<void> => {
      if (files.length > MAX_FILE_COUNT) {
        throw new Error(`一次最多上传 ${MAX_FILE_COUNT} 个文档`);
      }

      const documents = files.map((file) => {
        const contentType = getKnowledgeContentType(file);

        if (!contentType) {
          throw new Error(`${file.name} 的文件类型不受支持`);
        }

        if (file.size > MAX_FILE_SIZE) {
          throw new Error(`${file.name} 超过 100 MB`);
        }

        return { file, contentType };
      });

      const results = await Promise.allSettled(
        documents.map(({ file, contentType }) =>
          uploadKnowledgeDocument(knowledgeBaseId, file, contentType),
        ),
      );
      const failedUpload = results.find((result) => result.status === "rejected");

      if (failedUpload) {
        throw failedUpload.reason;
      }
    },
    onSettled: async () => {
      await refreshDocuments();
    },
  });

  const retryDocument = useMutation({
    mutationFn: async (documentId: string): Promise<void> => {
      await knowledgeDocumentsRetryDocument({
        path: { document_id: documentId },
        throwOnError: true,
      });
    },
    onSuccess: async () => {
      await refreshDocuments();
    },
  });

  const completeDocument = useMutation({
    mutationFn: async (documentId: string): Promise<void> => {
      await knowledgeDocumentsCompleteDocumentUpload({
        path: { document_id: documentId },
        throwOnError: true,
      });
    },
    onSuccess: async () => {
      await refreshDocuments();
    },
  });

  const deleteDocument = useMutation({
    mutationFn: async (documentId: string): Promise<void> => {
      await knowledgeDocumentsDeleteDocument({
        path: { document_id: documentId },
        throwOnError: true,
      });
    },
    onSuccess: async () => {
      if (documentsQuery.data?.data.length === 1 && currentPage > 1) {
        router.replace(getDocumentsHref(knowledgeBaseId, currentPage - 1));
      }

      setDocumentToDelete(undefined);
      await refreshDocuments();
    },
  });

  const downloadOriginal = useMutation({
    mutationFn: downloadOriginalKnowledgeDocument,
  });

  const downloadMarkdown = useMutation({
    mutationFn: downloadMarkdownKnowledgeDocument,
  });

  const searchKnowledge = useMutation({
    mutationFn: async (query: string) => {
      const { data } = await knowledgeBasesSearchKnowledgeBase({
        path: { knowledge_base_id: knowledgeBaseId },
        body: { query },
        throwOnError: true,
      });

      return data;
    },
  });

  const pageCount = Math.ceil((documentsQuery.data?.count ?? 0) / PAGE_SIZE);
  const paginationPages = getPaginationPages(currentPage, pageCount);
  const loadError = knowledgeBaseQuery.error || documentsQuery.error;
  const actionError =
    uploadDocument.error ||
    completeDocument.error ||
    retryDocument.error ||
    deleteDocument.error ||
    downloadOriginal.error ||
    downloadMarkdown.error;

  async function refreshDocuments(): Promise<void> {
    await queryClient.invalidateQueries({
      queryKey: [DOCUMENTS_QUERY_KEY, knowledgeBaseId],
    });
  }

  function submitUpload(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    uploadDocument.reset();
    const form = event.currentTarget;

    if (selectedFiles.length > 0) {
      uploadDocument.mutate(selectedFiles, {
        onSettled: () => {
          form.reset();
          setSelectedFiles([]);
        },
      });
    }
  }

  function submitSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    searchKnowledge.reset();
    const formData = new FormData(event.currentTarget);
    const query = String(formData.get("query") ?? "").trim();

    if (query) {
      searchKnowledge.mutate(query);
    }
  }

  if (knowledgeBaseQuery.isPending) {
    return <Skeleton className="m-6 h-64" />;
  }

  if (loadError || !knowledgeBaseQuery.data) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <AlertCircleIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>无法读取知识库</EmptyTitle>
          <EmptyDescription>
            {getApiErrorMessage(loadError, "读取知识库失败")}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <>
      <AppHeader
        title={knowledgeBaseQuery.data.name}
        left={
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href="/admin/knowledge-bases" aria-label="返回知识库列表">
              <ArrowLeftIcon aria-hidden="true" />
            </Link>
          </Button>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <Tabs
          defaultValue="documents"
          className="mx-auto min-h-full max-w-6xl gap-6"
          onValueChange={(value) => {
            if (value !== "documents") {
              setSelectedFiles([]);
            }
          }}
        >
          <TabsList>
            <TabsTrigger value="documents">文档</TabsTrigger>
            <TabsTrigger value="search">搜索</TabsTrigger>
          </TabsList>

          <TabsContent
            value="documents"
            className="flex flex-1 flex-col gap-6"
          >
            <Card>
              <CardHeader>
                <CardTitle>上传文档</CardTitle>
                <CardDescription className="flex flex-col gap-1">
                  <span>支持 PDF、Office、HTML、Markdown、TXT、CSV 和 JSON</span>
                  <span>
                    一次最多上传 {MAX_FILE_COUNT} 个文档，单个文件最大 100 MB
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={submitUpload}>
                  <FieldGroup>
                    <Field data-invalid={hasTooManyFiles}>
                      <FieldLabel
                        htmlFor="knowledge-document"
                        className="sr-only"
                      >
                        文档
                      </FieldLabel>
                      <Input
                        id="knowledge-document"
                        name="document"
                        type="file"
                        accept={KNOWLEDGE_ACCEPT}
                        aria-invalid={hasTooManyFiles}
                        disabled={uploadDocument.isPending}
                        multiple
                        onChange={(event) => {
                          uploadDocument.reset();
                          setSelectedFiles(
                            Array.from(event.currentTarget.files ?? []),
                          );
                        }}
                        required
                      />
                      {selectedFiles.length > 0 && (
                        <FieldDescription
                          className="break-words"
                          title={selectedFiles.map((file) => file.name).join("、")}
                        >
                          已选择：
                          {selectedFiles.map((file) => file.name).join("、")}
                        </FieldDescription>
                      )}
                      {hasTooManyFiles && (
                        <FieldError>
                          一次最多选择 {MAX_FILE_COUNT} 个文档，请重新选择
                        </FieldError>
                      )}
                    </Field>
                    <Button
                      type="submit"
                      className="self-end"
                      disabled={
                        uploadDocument.isPending ||
                        selectedFiles.length === 0 ||
                        hasTooManyFiles
                      }
                    >
                      {uploadDocument.isPending ? (
                        <Spinner data-icon="inline-start" />
                      ) : (
                        <UploadIcon data-icon="inline-start" aria-hidden="true" />
                      )}
                      {uploadDocument.isPending
                        ? "上传中…"
                        : selectedFiles.length > 0
                          ? `上传 ${selectedFiles.length} 个文档`
                          : "上传文档"}
                    </Button>
                  </FieldGroup>
                </form>
              </CardContent>
            </Card>

            {actionError && (
              <Alert variant="destructive">
                <AlertCircleIcon aria-hidden="true" />
                <AlertTitle>
                  {getApiErrorMessage(actionError, "文档操作失败")}
                </AlertTitle>
              </Alert>
            )}

            {documentsQuery.isPending ? (
              <Skeleton className="h-64" />
            ) : documentsQuery.data?.data.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <FileTextIcon aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyTitle>暂无文档</EmptyTitle>
                  <EmptyDescription>上传文档后会在这里显示处理状态。</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>文件名</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>大小</TableHead>
                    <TableHead>上传时间</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documentsQuery.data?.data.map((document) => (
                    <TableRow key={document.id}>
                      <TableCell>
                        <div className="max-w-md">
                          <div className="truncate font-medium">
                            {document.status === "ready" ? (
                              <Link
                                href={`/admin/knowledge-bases/${knowledgeBaseId}/documents/${document.id}`}
                                className="hover:underline"
                              >
                                {document.filename}
                              </Link>
                            ) : (
                              document.filename
                            )}
                          </div>
                          {document.error_message && (
                            <div className="text-destructive truncate text-sm">
                              {document.error_message}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            document.status === "ready" ? "outline" : "secondary"
                          }
                        >
                          {statusLabels[document.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatFileSize(document.size)}</TableCell>
                      <TableCell>
                        {dateFormatter.format(new Date(document.created_at))}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`${document.filename} 的更多操作`}
                            >
                              <MoreHorizontalIcon aria-hidden="true" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuGroup>
                              {document.status === "pending" && (
                                <DropdownMenuItem
                                  disabled={
                                    uploadDocument.isPending ||
                                    completeDocument.isPending
                                  }
                                  onSelect={() =>
                                    completeDocument.mutate(document.id)
                                  }
                                >
                                  <UploadIcon aria-hidden="true" />
                                  确认上传
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                disabled={downloadOriginal.isPending}
                                onSelect={() =>
                                  downloadOriginal.mutate(document.id)
                                }
                              >
                                <DownloadIcon aria-hidden="true" />
                                下载原文件
                              </DropdownMenuItem>
                              {document.status === "ready" && (
                                <DropdownMenuItem
                                  disabled={downloadMarkdown.isPending}
                                  onSelect={() =>
                                    downloadMarkdown.mutate(document.id)
                                  }
                                >
                                  <FileTextIcon aria-hidden="true" />
                                  下载 Markdown
                                </DropdownMenuItem>
                              )}
                              {(document.status === "failed" ||
                                document.status === "timed_out") && (
                                <DropdownMenuItem
                                  disabled={retryDocument.isPending}
                                  onSelect={() => retryDocument.mutate(document.id)}
                                >
                                  <RefreshCwIcon aria-hidden="true" />
                                  重试
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => setDocumentToDelete(document)}
                              >
                                <TrashIcon aria-hidden="true" />
                                删除
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {pageCount > 0 && (
              <Pagination className="mt-auto" aria-label="知识库文档分页">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href={getDocumentsHref(
                        knowledgeBaseId,
                        Math.max(1, currentPage - 1),
                      )}
                      aria-disabled={currentPage <= 1}
                      tabIndex={currentPage <= 1 ? -1 : undefined}
                    />
                  </PaginationItem>
                  {paginationPages.map((page, index) => (
                    <PaginationItem key={`${page}-${index}`}>
                      {page === PAGINATION_ELLIPSIS ? (
                        <PaginationEllipsis />
                      ) : (
                        <PaginationLink
                          href={getDocumentsHref(knowledgeBaseId, page)}
                          isActive={page === currentPage}
                        >
                          {page}
                        </PaginationLink>
                      )}
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      href={getDocumentsHref(
                        knowledgeBaseId,
                        Math.min(pageCount, currentPage + 1),
                      )}
                      aria-disabled={currentPage >= pageCount}
                      tabIndex={currentPage >= pageCount ? -1 : undefined}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </TabsContent>

          <TabsContent value="search" className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>搜索知识库</CardTitle>
                <CardDescription>
                  输入问题，查看当前知识库中最相关的内容片段。
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={submitSearch}>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="knowledge-search-query">
                        问题
                      </FieldLabel>
                      <Input
                        id="knowledge-search-query"
                        name="query"
                        autoComplete="off"
                        placeholder="输入想了解的问题…"
                        maxLength={1000}
                        required
                      />
                    </Field>
                    <Button type="submit" disabled={searchKnowledge.isPending}>
                      {searchKnowledge.isPending ? (
                        <Spinner data-icon="inline-start" />
                      ) : (
                        <SearchIcon data-icon="inline-start" aria-hidden="true" />
                      )}
                      搜索
                    </Button>
                  </FieldGroup>
                </form>
              </CardContent>
            </Card>

            {searchKnowledge.error && (
              <Alert variant="destructive">
                <AlertCircleIcon aria-hidden="true" />
                <AlertTitle>
                  {getApiErrorMessage(searchKnowledge.error, "搜索失败")}
                </AlertTitle>
              </Alert>
            )}

            {searchKnowledge.data?.data.length === 0 && (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <SearchIcon aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyTitle>未找到相关内容</EmptyTitle>
                  <EmptyDescription>
                    可以换个问法，或确认相关文档已处理完成。
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}

            {searchKnowledge.data?.data.map((result, index) => (
              <Card key={`${result.document_id}-${index}`}>
                <CardHeader>
                  <CardTitle>{result.filename}</CardTitle>
                  <CardDescription>
                    {formatSource(result.section_path, result.page_numbers)} ·
                    相关度 {scoreFormatter.format(result.score)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap break-words">
                    {result.content}
                  </p>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog
        open={documentToDelete !== undefined}
        onOpenChange={(open) => {
          if (!open && !deleteDocument.isPending) setDocumentToDelete(undefined);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除文档</AlertDialogTitle>
            <AlertDialogDescription>
              确定删除“{documentToDelete?.filename}”吗？原文件、解析产物和检索索引都会删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteDocument.isPending}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteDocument.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (documentToDelete) {
                  deleteDocument.mutate(documentToDelete.id);
                }
              }}
            >
              {deleteDocument.isPending && <Spinner data-icon="inline-start" />}
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function getKnowledgeContentType(file: File): string | undefined {
  if (KNOWLEDGE_CONTENT_TYPES.includes(file.type)) {
    return file.type;
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  const contentTypesByExtension: Record<string, string> = {
    csv: "text/csv",
    html: "text/html",
    json: "application/json",
    md: "text/markdown",
    txt: "text/plain",
  };

  return extension ? contentTypesByExtension[extension] : undefined;
}

async function uploadKnowledgeDocument(
  knowledgeBaseId: string,
  file: File,
  contentType: string,
): Promise<void> {
  const { data: upload } = await knowledgeBasesCreateDocumentUpload({
    path: { knowledge_base_id: knowledgeBaseId },
    body: {
      filename: file.name,
      contentType,
      size: file.size,
    },
    throwOnError: true,
  });

  try {
    const response = await fetch(upload.uploadUrl, {
      method: "PUT",
      headers: upload.uploadHeaders,
      body: file,
    });

    if (!response.ok) {
      throw new Error(`对象存储上传失败（${response.status}）`);
    }
  } catch (error) {
    await knowledgeDocumentsDeleteDocument({
      path: { document_id: upload.id },
    });

    throw error;
  }

  await knowledgeDocumentsCompleteDocumentUpload({
    path: { document_id: upload.id },
    throwOnError: true,
  });
}

function formatFileSize(size: number): string {
  if (size < 1024 * 1024) {
    return `${sizeFormatter.format(size / 1024)} KB`;
  }

  return `${sizeFormatter.format(size / 1024 / 1024)} MB`;
}

function formatSource(sectionPath: string[], pageNumbers: number[]): string {
  const parts = [
    sectionPath.length > 0 ? sectionPath.join(" / ") : undefined,
    pageNumbers.length > 0 ? `第 ${pageNumbers.join("、")} 页` : undefined,
  ].filter(Boolean);

  return parts.join(" · ") || "未标注位置";
}

function getDocumentsHref(knowledgeBaseId: string, page: number): string {
  return getPaginationHref(`/admin/knowledge-bases/${knowledgeBaseId}`, page);
}
