"use client";

import { useIsMutating, useMutation } from "@tanstack/react-query";
import {
  FileTextIcon,
  UploadIcon,
  DownloadIcon,
  ExternalLinkIcon,
  RefreshCwIcon,
  FolderInputIcon,
  MoreHorizontalIcon,
  TrashIcon,
} from "lucide-react";
import {
  useRef,
  useState,
  type RefObject,
  type SyntheticEvent,
} from "react";
import { toast } from "sonner";

import {
  type DirectoryChange,
  type DirectoryEntry,
  KNOWLEDGE_DOCUMENT_UPLOAD_KEY,
} from "@/app/admin/knowledge-bases/_lib/directory";
import { ButtonContent } from "@/components/common/button-content";
import { FolderActions } from "@/components/common/folder-actions";
import { FolderEditorDialog } from "@/components/common/folder-editor-dialog";
import { FolderPickerDialog } from "@/components/common/folder-picker-dialog";
import { DeleteDialog } from "@/components/common/delete-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

function showDocumentActionError(error: Error): void {
  toast.error(getApiErrorMessage(error, "文档操作失败，请重试"));
}

function showDownloadStarted(): void {
  toast.success("文档已开始下载");
}

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
      toast.success("文档上传已确认");
      onChanged({ type: "documents" });
    },
    onError: showDocumentActionError,
  });

  const retryDocumentMutation = useMutation({
    mutationFn: (documentId: string) =>
      knowledgeDocumentsRetryDocument({
        path: { document_id: documentId },
        throwOnError: true,
      }),
    onSuccess: () => {
      toast.success("文档已提交重新解析");
      onChanged({ type: "documents" });
    },
    onError: showDocumentActionError,
  });

  const downloadOriginalMutation = useMutation({
    mutationFn: downloadOriginalKnowledgeDocument,
    onSuccess: showDownloadStarted,
    onError: showDocumentActionError,
  });

  const downloadMarkdownMutation = useMutation({
    mutationFn: downloadMarkdownKnowledgeDocument,
    onSuccess: showDownloadStarted,
    onError: showDocumentActionError,
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
      toast.success("项目已移动");
      actionTriggerRef.current = null;
      setEntryToMove(undefined);
      onChanged({ type: "moved", entry });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "项目移动失败，请重试"));
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
      toast.success("项目已删除");
      actionTriggerRef.current = null;
      setDeleteTarget(undefined);
      onChanged({ type: "deleted", entries: target.entries });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "项目删除失败，请重试"));
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

  const documentPending = [
    completeDocumentMutation,
    downloadOriginalMutation,
    downloadMarkdownMutation,
    retryDocumentMutation,
  ].some((mutation) => mutation.isPending && mutation.variables === entry.id);

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
          disabled={documentPending}
          aria-busy={documentPending}
          onFocus={rememberActionTrigger}
          onPointerDown={rememberActionTrigger}
        >
          <ButtonContent loading={documentPending} icon={MoreHorizontalIcon} />
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
              disabled={
                downloadOriginalMutation.isPending ||
                downloadMarkdownMutation.isPending
              }
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
              disabled={
                downloadOriginalMutation.isPending ||
                downloadMarkdownMutation.isPending
              }
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
        <FolderEditorDialog
          kind="knowledge"
          libraryId={knowledgeBaseId}
          parentFolderId={currentFolderId}
          folder={folderToEdit ?? undefined}
          onClose={() => editFolder(undefined)}
          onSaved={onFolderSaved}
          onCloseAutoFocus={restoreActionFocus}
        />
      )}

      <DeleteDialog
        open={deleteTarget !== undefined}
        pending={deleteEntriesMutation.isPending}
        title={
          deleteTargetCount > 1
            ? `删除 ${deleteTargetCount} 个项目`
            : "删除项目"
        }
        onOpenChange={(open) => {
          if (!open) closeDelete();
        }}
        onConfirm={() => {
          if (deleteTarget) deleteEntriesMutation.mutate(deleteTarget);
        }}
        onCloseAutoFocus={restoreActionFocus}
      >
        {deleteTarget?.label
          ? `确定删除“${deleteTarget.label}”吗？`
          : "确定删除选中的项目吗？"}
        {deleteTarget &&
        deleteTarget.entries.some((entry) => entry.type === "folder")
          ? "文件夹内的子文件夹和文档也会删除。"
          : null}
        文档原文件、解析产物和检索索引都会删除。
      </DeleteDialog>

      {entryToMove && (
        <FolderPickerDialog
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
