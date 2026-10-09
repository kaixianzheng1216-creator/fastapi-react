"use client";

import { useIsMutating, useMutation } from "@tanstack/react-query";
import {
  ChevronDownIcon,
  FileTextIcon,
  UploadIcon,
  DownloadIcon,
  ExternalLinkIcon,
  RefreshCwIcon,
  FolderInputIcon,
  MoreHorizontalIcon,
  TrashIcon,
} from "lucide-react";
import { useState, type RefObject } from "react";
import { useActionFocus } from "@/hooks/use-action-focus";
import { toast } from "sonner";

import {
  type DirectoryChange,
  type DirectoryEntry,
  KNOWLEDGE_DOCUMENT_UPLOAD_KEY,
} from "@/app/admin/(project)/knowledge-bases/_lib/directory";
import { ButtonContent } from "@/components/common/button-content";
import { FolderActions } from "@/components/common/folder-actions";
import { FolderEditorDialog } from "./folder-editor-dialog";
import { FolderPickerDialog } from "@/components/common/folder-picker-dialog";
import { DeleteDialog } from "@/components/common/delete-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import {
  canRunDocumentAction,
  runDocumentBatch,
  type DocumentBatchAction,
} from "../_lib/document-batch";

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

export function useDirectoryActions({
  knowledgeBaseId,
  focusFallbackRef,
  onChanged,
}: UseDirectoryActionsOptions) {
  const { rememberActionTrigger, restoreActionFocus, clearActionTrigger } =
    useActionFocus(focusFallbackRef);

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

  const documentMutation = useMutation({
    mutationFn: ({
      entries,
      action,
    }: {
      entries: DirectoryEntry[];
      action: DocumentBatchAction;
    }) =>
      runDocumentBatch(
        entries,
        action,
        action === "retry"
          ? (documentId) =>
              knowledgeDocumentsRetryDocument({
                path: { document_id: documentId },
                throwOnError: true,
              })
          : action === "original"
            ? downloadOriginalKnowledgeDocument
            : downloadMarkdownKnowledgeDocument,
      ),
    onSuccess: ({ succeeded, failures, skipped }, { action }) => {
      const summary = [
        action === "retry"
          ? `已提交 ${succeeded} 个文档重新解析`
          : `已发起 ${succeeded} 个文档下载`,
        failures.length > 0 ? `${failures.length} 个失败` : "",
        skipped > 0 ? `已跳过 ${skipped} 个不适用项` : "",
      ]
        .filter(Boolean)
        .join("，");

      const firstFailure = failures[0];

      const description = firstFailure
        ? `${firstFailure.filename}：${getApiErrorMessage(firstFailure.error, "操作失败，请重试")}`
        : action !== "retry" && succeeded > 1
          ? "如浏览器询问，请允许此网站下载多个文件。"
          : undefined;

      if (failures.length > 0) toast.error(summary, { description });
      else toast.success(summary, { description });
    },
    onError: showDocumentActionError,
    onSettled: (_, __, { action }) => {
      if (action === "retry") onChanged({ type: "documents" });
    },
  });

  const [folderToEdit, setFolderToEdit] =
    useState<KnowledgeFolderPublic | null>();
  const [entriesToMove, setEntriesToMove] = useState<DirectoryEntry[]>();

  const moveEntriesMutation = useMutation({
    mutationFn: async ({
      entries,
      folderId,
    }: {
      entries: DirectoryEntry[];
      folderId: string | null;
    }) => {
      const moved: DirectoryEntry[] = [];
      const failures: { entry: DirectoryEntry; error: unknown }[] = [];

      for (const entry of entries) {
        try {
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

          moved.push(entry);
        } catch (error) {
          failures.push({ entry, error });
        }
      }

      return { moved, failures };
    },
    onSuccess: ({ moved, failures }, { folderId }) => {
      if (moved.length > 0) {
        onChanged({ type: "moved", entries: moved, folderId });
      }

      if (failures.length > 0) {
        setEntriesToMove(failures.map(({ entry }) => entry));
        toast.error(`已移动 ${moved.length} 项，${failures.length} 项失败`, {
          description: getApiErrorMessage(
            failures[0].error,
            "项目移动失败，请重试",
          ),
        });
        return;
      }

      toast.success(`已移动 ${moved.length} 项`);
      clearActionTrigger();
      setEntriesToMove(undefined);
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
      clearActionTrigger();
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
    if (!moveEntriesMutation.isPending) setEntriesToMove(undefined);
  }

  function onFolderSaved(): void {
    setFolderToEdit(undefined);
    onChanged({ type: "folders" });
  }

  return {
    rememberActionTrigger,
    restoreActionFocus,
    isUploading,
    isActionPending: [
      documentMutation,
      completeDocumentMutation,
      deleteEntriesMutation,
      moveEntriesMutation,
    ].some((mutation) => mutation.isPending),
    completeDocumentMutation,
    documentMutation,
    folderToEdit,
    editFolder: setFolderToEdit,
    onFolderSaved,
    entriesToMove,
    moveEntriesMutation,
    openMoveEntry: (entry: DirectoryEntry) => setEntriesToMove([entry]),
    openMoveEntries: setEntriesToMove,
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

export function DirectoryBatchActions({
  entries,
  actions,
  disabled,
}: {
  entries: DirectoryEntry[];
  actions: DirectoryActions;
  disabled: boolean;
}) {
  const { documentMutation: mutation } = actions;
  const canDownloadOriginal = entries.some((entry) =>
    canRunDocumentAction(entry, "original"),
  );
  const canDownloadMarkdown = entries.some((entry) =>
    canRunDocumentAction(entry, "markdown"),
  );
  const canRetry = entries.some((entry) =>
    canRunDocumentAction(entry, "retry"),
  );
  const busy = disabled || actions.isActionPending;
  const noSelection = entries.length === 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          aria-busy={actions.isActionPending}
          onFocus={actions.rememberActionTrigger}
          onPointerDown={actions.rememberActionTrigger}
        >
          <ButtonContent loading={actions.isActionPending}>
            更多操作
          </ButtonContent>
          <ChevronDownIcon data-icon="inline-end" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuGroup>
          <DropdownMenuItem
            disabled={busy || !canDownloadOriginal}
            onSelect={() => mutation.mutate({ entries, action: "original" })}
          >
            下载原文件
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={busy || !canDownloadMarkdown}
            onSelect={() => mutation.mutate({ entries, action: "markdown" })}
          >
            下载 Markdown
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={busy || noSelection}
            onSelect={() => actions.openMoveEntries(entries)}
          >
            移动到…
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={busy || !canRetry}
            onSelect={() => mutation.mutate({ entries, action: "retry" })}
          >
            重试处理
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            variant="destructive"
            disabled={busy || noSelection}
            onSelect={() => actions.openDeleteEntries(entries)}
          >
            删除选中项
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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
    documentMutation: mutation,
    openMoveEntry,
    editFolder,
    openDeleteEntry,
  } = actions;

  const documentPending =
    (mutation.isPending &&
      mutation.variables.entries.some(
        (document) =>
          document.id === entry.id &&
          canRunDocumentAction(document, mutation.variables.action),
      )) ||
    (completeDocumentMutation.isPending &&
      completeDocumentMutation.variables === entry.id);

  return entry.type === "folder" ? (
    <FolderActions
      name={entry.name}
      variant="ghost"
      disabled={actions.isActionPending}
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
              disabled={isUploading || actions.isActionPending}
              onSelect={() => completeDocumentMutation.mutate(entry.id)}
            >
              <UploadIcon aria-hidden="true" />
              确认上传
            </DropdownMenuItem>
          ) : null}
          {canRunDocumentAction(entry, "original") ? (
            <DropdownMenuItem
              disabled={actions.isActionPending}
              onSelect={() =>
                mutation.mutate({ entries: [entry], action: "original" })
              }
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
          {canRunDocumentAction(entry, "markdown") ? (
            <DropdownMenuItem
              disabled={actions.isActionPending}
              onSelect={() =>
                mutation.mutate({ entries: [entry], action: "markdown" })
              }
            >
              <FileTextIcon aria-hidden="true" />
              下载 Markdown
            </DropdownMenuItem>
          ) : null}
          {canRunDocumentAction(entry, "retry") ? (
            <DropdownMenuItem
              disabled={actions.isActionPending}
              onSelect={() =>
                mutation.mutate({ entries: [entry], action: "retry" })
              }
            >
              <RefreshCwIcon aria-hidden="true" />
              重试
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            disabled={actions.isActionPending}
            onSelect={() => openMoveEntry(entry)}
          >
            <FolderInputIcon aria-hidden="true" />
            移动到
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            disabled={actions.isActionPending}
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
    entriesToMove,
    moveEntriesMutation,
    closeMove,
  } = actions;
  const deleteTargetCount = deleteTarget?.entries.length ?? 0;
  const moveFolderIds = new Set(
    entriesToMove?.map((entry) =>
      entry.type === "folder" ? entry.parent_id : entry.folder_id,
    ),
  );
  const moveFolderId =
    moveFolderIds.size === 1 ? [...moveFolderIds][0] : undefined;

  return (
    <>
      {folderToEdit !== undefined && (
        <FolderEditorDialog
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
          : `确定删除选中的 ${deleteTargetCount} 项吗？`}
        {deleteTarget &&
        deleteTarget.entries.some((entry) => entry.type === "folder")
          ? "文件夹内的子文件夹和文档也会删除。"
          : null}
        文档原文件、解析产物和检索索引都会删除。
      </DeleteDialog>

      {entriesToMove && (
        <FolderPickerDialog
          onCloseAutoFocus={restoreActionFocus}
          onClose={closeMove}
          folders={folders}
          currentFolderId={moveFolderId}
          excludedFolderIds={entriesToMove
            .filter((entry) => entry.type === "folder")
            .map((entry) => entry.id)}
          title={entriesToMove.length > 1 ? "批量移动" : "移动项目"}
          description={`选择 ${entriesToMove.length} 个项目的目标文件夹。`}
          isPending={moveEntriesMutation.isPending}
          onMove={(folderId) =>
            moveEntriesMutation.mutate({ entries: entriesToMove, folderId })
          }
        />
      )}
    </>
  );
}
