"use client";

import { useIsMutating, useMutation } from "@tanstack/react-query";
import {
  FileTextIcon,
  UploadIcon,
  DownloadIcon,
  ExternalLinkIcon,
  RefreshCwIcon,
  FolderInputIcon,
  FolderPlusIcon,
  MoreHorizontalIcon,
  PencilIcon,
  TrashIcon,
} from "lucide-react";
import {
  useRef,
  useState,
  type ReactEventHandler,
  type RefObject,
  type SyntheticEvent,
} from "react";
import { toast } from "sonner";

import {
  type DirectoryChange,
  type DirectoryEntry,
  KNOWLEDGE_DOCUMENT_UPLOAD_KEY,
} from "@/app/admin/knowledge-bases/_lib/directory";
import { KnowledgeFolderEditorDialog } from "@/app/admin/knowledge-bases/_components/folder-dialog";
import { KnowledgeFolderPickerDialog } from "@/app/admin/knowledge-bases/_components/folder-picker-dialog";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  type KnowledgeFolderPublic,
  knowledgeBasesDeleteDirectoryEntries,
  knowledgeBasesMoveFolder,
  knowledgeDocumentsCompleteDocumentUpload,
  knowledgeDocumentsMoveDocument,
  knowledgeDocumentsRetryDocument,
} from "@/lib/client";
import {
  downloadMarkdownKnowledgeDocument,
  downloadOriginalKnowledgeDocument,
} from "@/lib/knowledge-document-download";

type DirectoryDeleteTarget = {
  entries: DirectoryEntry[];
  label?: string;
};

type UseDirectoryActionsOptions = {
  knowledgeBaseId: string;
  focusFallbackRef: RefObject<HTMLElement | null>;
  onChanged: (change: DirectoryChange) => void;
};

export function useDirectoryActions({
  knowledgeBaseId,
  focusFallbackRef,
  onChanged,
}: UseDirectoryActionsOptions) {
  const actionTriggerRef = useRef<HTMLButtonElement>(null);

  function rememberActionTrigger(
    event: SyntheticEvent<HTMLButtonElement>,
  ): void {
    actionTriggerRef.current = event.currentTarget;
  }

  function restoreActionFocus(event: Event): void {
    event.preventDefault();

    const trigger = actionTriggerRef.current;
    const target = trigger?.isConnected ? trigger : focusFallbackRef.current;

    target?.focus();
  }

  const isUploading =
    useIsMutating({
      mutationKey: [...KNOWLEDGE_DOCUMENT_UPLOAD_KEY, knowledgeBaseId],
    }) > 0;

  const completeDocumentMutation = useMutation({
    mutationFn: (documentId: string) =>
      knowledgeDocumentsCompleteDocumentUpload({
        path: { document_id: documentId },
        throwOnError: true,
      }),
    onSuccess: () => {
      toast.success("上传已确认");
      onChanged({ type: "documents" });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "文档操作失败，请重试"));
    },
  });

  const retryDocumentMutation = useMutation({
    mutationFn: (documentId: string) =>
      knowledgeDocumentsRetryDocument({
        path: { document_id: documentId },
        throwOnError: true,
      }),
    onSuccess: () => {
      toast.success("已提交重新解析");
      onChanged({ type: "documents" });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "文档操作失败，请重试"));
    },
  });

  const downloadOriginalMutation = useMutation({
    mutationFn: downloadOriginalKnowledgeDocument,
    onSuccess: () => {
      toast.success("已开始下载");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "文档操作失败，请重试"));
    },
  });

  const downloadMarkdownMutation = useMutation({
    mutationFn: downloadMarkdownKnowledgeDocument,
    onSuccess: () => {
      toast.success("已开始下载");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "文档操作失败，请重试"));
    },
  });

  const [folderToEdit, setFolderToEdit] =
    useState<KnowledgeFolderPublic | null>();
  const [entryToMove, setEntryToMove] = useState<DirectoryEntry>();

  const moveEntryMutation = useMutation({
    mutationFn: async ({
      entry,
      folderId,
    }: {
      entry: DirectoryEntry;
      folderId: string | null;
    }) => {
      if (entry.type === "folder") {
        await knowledgeBasesMoveFolder({
          path: { knowledge_base_id: knowledgeBaseId, folder_id: entry.id },
          body: { parent_id: folderId },
          throwOnError: true,
        });
      } else {
        await knowledgeDocumentsMoveDocument({
          path: { document_id: entry.id },
          body: { folder_id: folderId },
          throwOnError: true,
        });
      }
    },
    onSuccess: (_, { entry }) => {
      toast.success("已移动");
      actionTriggerRef.current = null;
      setEntryToMove(undefined);
      onChanged({ type: "moved", entry });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "移动失败，请重试"));
    },
  });

  const [deleteTarget, setDeleteTarget] = useState<DirectoryDeleteTarget>();

  const deleteEntriesMutation = useMutation({
    mutationFn: (target: DirectoryDeleteTarget) =>
      knowledgeBasesDeleteDirectoryEntries({
        path: { knowledge_base_id: knowledgeBaseId },
        body: {
          folder_ids: target.entries
            .filter((entry) => entry.type === "folder")
            .map((entry) => entry.id),
          document_ids: target.entries
            .filter((entry) => entry.type === "document")
            .map((entry) => entry.id),
        },
        throwOnError: true,
      }),
    onSuccess: (_, target) => {
      toast.success("已删除");
      actionTriggerRef.current = null;
      setDeleteTarget(undefined);
      onChanged({ type: "deleted", entries: target.entries });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "删除失败，请重试"));
    },
  });

  function openDeleteEntry(entry: DirectoryEntry): void {
    setDeleteTarget({
      entries: [entry],
      label: entry.type === "folder" ? entry.name : entry.filename,
    });
  }

  function closeDelete(): void {
    if (!deleteEntriesMutation.isPending) setDeleteTarget(undefined);
  }

  function closeMove(): void {
    if (!moveEntryMutation.isPending) setEntryToMove(undefined);
  }

  function onFolderSaved(): void {
    setFolderToEdit(undefined);
    onChanged({ type: "folders" });
  }

  return {
    rememberActionTrigger,
    restoreActionFocus,
    isUploading,
    completeDocumentMutation,
    retryDocumentMutation,
    downloadOriginalMutation,
    downloadMarkdownMutation,
    folderToEdit,
    editFolder: setFolderToEdit,
    onFolderSaved,
    entryToMove,
    moveEntryMutation,
    openMoveEntry: setEntryToMove,
    closeMove,
    deleteTarget,
    deleteEntriesMutation,
    openDeleteEntry,
    openDeleteEntries: (entries: DirectoryEntry[]) =>
      setDeleteTarget({ entries }),
    closeDelete,
  };
}

type DirectoryActions = ReturnType<typeof useDirectoryActions>;

export function DirectoryEntryActions({
  entry,
  actions,
}: {
  entry: DirectoryEntry;
  actions: DirectoryActions;
}) {
  const {
    rememberActionTrigger,
    isUploading,
    completeDocumentMutation,
    retryDocumentMutation,
    downloadOriginalMutation,
    downloadMarkdownMutation,
    openMoveEntry,
    editFolder,
    openDeleteEntry,
  } = actions;

  return entry.type === "folder" ? (
    <FolderActions
      name={entry.name}
      variant="ghost"
      onTriggerInteraction={rememberActionTrigger}
      onMove={() => openMoveEntry(entry)}
      onRename={() => editFolder(entry)}
      onDelete={() => openDeleteEntry(entry)}
    />
  ) : (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`${entry.filename} 的更多操作`}
          onFocus={rememberActionTrigger}
          onPointerDown={rememberActionTrigger}
        >
          <MoreHorizontalIcon aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          {entry.status === "pending" && !entry.uploaded ? (
            <DropdownMenuItem
              disabled={isUploading || completeDocumentMutation.isPending}
              onSelect={() => completeDocumentMutation.mutate(entry.id)}
            >
              <UploadIcon aria-hidden="true" />
              确认上传
            </DropdownMenuItem>
          ) : null}
          {entry.uploaded ? (
            <DropdownMenuItem
              disabled={downloadOriginalMutation.isPending}
              onSelect={() => downloadOriginalMutation.mutate(entry.id)}
            >
              <DownloadIcon aria-hidden="true" />
              下载原文件
            </DropdownMenuItem>
          ) : null}
          {entry.source_url ? (
            <DropdownMenuItem asChild>
              <a href={entry.source_url} target="_blank" rel="noreferrer">
                <ExternalLinkIcon aria-hidden="true" />
                访问原网页
              </a>
            </DropdownMenuItem>
          ) : null}
          {entry.status === "ready" ? (
            <DropdownMenuItem
              disabled={downloadMarkdownMutation.isPending}
              onSelect={() => downloadMarkdownMutation.mutate(entry.id)}
            >
              <FileTextIcon aria-hidden="true" />
              下载 Markdown
            </DropdownMenuItem>
          ) : null}
          {entry.status === "failed" || entry.status === "timed_out" ? (
            <DropdownMenuItem
              disabled={retryDocumentMutation.isPending}
              onSelect={() => retryDocumentMutation.mutate(entry.id)}
            >
              <RefreshCwIcon aria-hidden="true" />
              重试
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={() => openMoveEntry(entry)}>
            <FolderInputIcon aria-hidden="true" />
            移动到
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => openDeleteEntry(entry)}
          >
            <TrashIcon aria-hidden="true" />
            删除
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DirectoryToolbar({
  actions,
  currentFolder,
  selectedEntries,
}: {
  actions: DirectoryActions;
  currentFolder?: KnowledgeFolderPublic;
  selectedEntries: DirectoryEntry[];
}) {
  const {
    deleteEntriesMutation,
    rememberActionTrigger,
    openDeleteEntries,
    openDeleteEntry,
    openMoveEntry,
    editFolder,
  } = actions;
  const selectedEntryCount = selectedEntries.length;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {selectedEntryCount > 0 ? (
        <>
          <Badge variant="secondary" aria-live="polite">
            已选择 {selectedEntryCount} 项
          </Badge>
          <Button
            variant="destructive"
            size="sm"
            disabled={deleteEntriesMutation.isPending}
            onFocus={rememberActionTrigger}
            onPointerDown={rememberActionTrigger}
            onClick={() => openDeleteEntries(selectedEntries)}
          >
            <TrashIcon data-icon="inline-start" aria-hidden="true" />
            删除
          </Button>
        </>
      ) : null}
      {currentFolder ? (
        <FolderActions
          name={currentFolder.name}
          variant="outline"
          onTriggerInteraction={rememberActionTrigger}
          onMove={() => openMoveEntry({ ...currentFolder, type: "folder" })}
          onRename={() => editFolder(currentFolder)}
          onDelete={() => openDeleteEntry({ ...currentFolder, type: "folder" })}
        />
      ) : null}
      <Button
        variant="outline"
        size="sm"
        onClick={() => editFolder(null)}
        onFocus={rememberActionTrigger}
        onPointerDown={rememberActionTrigger}
      >
        <FolderPlusIcon data-icon="inline-start" aria-hidden="true" />
        新建文件夹
      </Button>
    </div>
  );
}

export function DirectoryActionDialogs({
  actions,
  knowledgeBaseId,
  currentFolderId,
  folders,
}: {
  actions: DirectoryActions;
  knowledgeBaseId: string;
  currentFolderId?: string;
  folders: KnowledgeFolderPublic[];
}) {
  const {
    folderToEdit,
    editFolder,
    onFolderSaved,
    restoreActionFocus,
    deleteTarget,
    deleteEntriesMutation,
    closeDelete,
    entryToMove,
    moveEntryMutation,
    closeMove,
  } = actions;
  const deleteTargetCount = deleteTarget?.entries.length ?? 0;

  return (
    <>
      {folderToEdit !== undefined && (
        <KnowledgeFolderEditorDialog
          knowledgeBaseId={knowledgeBaseId}
          parentFolderId={currentFolderId}
          folder={folderToEdit ?? undefined}
          onClose={() => editFolder(undefined)}
          onSaved={onFolderSaved}
          onCloseAutoFocus={restoreActionFocus}
        />
      )}

      <AlertDialog
        open={deleteTarget !== undefined}
        onOpenChange={(open) => {
          if (!open) closeDelete();
        }}
      >
        <AlertDialogContent onCloseAutoFocus={restoreActionFocus}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTargetCount > 1
                ? `删除 ${deleteTargetCount} 个项目`
                : "删除项目"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.label
                ? `确定删除“${deleteTarget.label}”吗？`
                : "确定删除选中的项目吗？"}
              {deleteTarget &&
              deleteTarget.entries.some((entry) => entry.type === "folder")
                ? "文件夹内的子文件夹和文档也会删除。"
                : null}
              文档原文件、解析产物和检索索引都会删除。
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteEntriesMutation.isPending}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteEntriesMutation.isPending}
              onClick={(event) => {
                event.preventDefault();

                if (deleteTarget) {
                  deleteEntriesMutation.mutate(deleteTarget);
                }
              }}
            >
              {deleteEntriesMutation.isPending ? (
                <Spinner data-icon="inline-start" />
              ) : null}
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {entryToMove && (
        <KnowledgeFolderPickerDialog
          onCloseAutoFocus={restoreActionFocus}
          onClose={closeMove}
          folders={folders}
          currentFolderId={
            entryToMove.type === "folder"
              ? entryToMove.parent_id
              : entryToMove.folder_id
          }
          excludedFolderId={
            entryToMove.type === "folder" ? entryToMove.id : undefined
          }
          title={entryToMove.type === "folder" ? "移动文件夹" : "移动文档"}
          description={`选择“${entryToMove.type === "folder" ? entryToMove.name : entryToMove.filename}”的新位置。`}
          isPending={moveEntryMutation.isPending}
          onMove={(folderId) =>
            moveEntryMutation.mutate({ entry: entryToMove, folderId })
          }
        />
      )}
    </>
  );
}

function FolderActions({
  name,
  variant,
  onTriggerInteraction,
  onMove,
  onRename,
  onDelete,
}: {
  name: string;
  variant: "outline" | "ghost";
  onTriggerInteraction: ReactEventHandler<HTMLButtonElement>;
  onMove: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size="icon-sm"
          aria-label={`${name} 的更多操作`}
          onFocus={onTriggerInteraction}
          onPointerDown={onTriggerInteraction}
        >
          <MoreHorizontalIcon aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={onMove}>
            <FolderInputIcon aria-hidden="true" />
            移动到
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onRename}>
            <PencilIcon aria-hidden="true" />
            重命名
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={onDelete}>
            <TrashIcon aria-hidden="true" />
            删除
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
