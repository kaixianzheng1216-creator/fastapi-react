"use client";

import { useIsMutating, useMutation } from "@tanstack/react-query";
import {
  UploadIcon,
  DownloadIcon,
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
  LIBRARY_DOCUMENT_UPLOAD_KEY,
} from "@/app/admin/file-libraries/_lib/directory";
import { FolderEditorDialog } from "@/components/common/folder-editor-dialog";
import { FolderPickerDialog } from "@/components/common/folder-picker-dialog";
import { DeleteDialog } from "@/components/common/delete-dialog";
import { Badge } from "@/components/ui/badge";
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
  type LibraryFolderPublic,
  fileLibrariesDeleteDirectoryEntries,
  fileLibrariesMoveFolder,
  libraryDocumentsCompleteDocumentUpload,
  libraryDocumentsMoveDocument,
} from "@/lib/client";
import { downloadOriginalLibraryDocument } from "@/lib/library-document-download";

type DirectoryDeleteTarget = {
  entries: DirectoryEntry[];
  label?: string;
};

type UseDirectoryActionsOptions = {
  fileLibraryId: string;
  focusFallbackRef: RefObject<HTMLElement | null>;
  onChanged: (change: DirectoryChange) => void;
};

function showDocumentActionError(error: Error): void {
  toast.error(getApiErrorMessage(error, "文件操作失败，请重试"));
}

function showDownloadStarted(): void {
  toast.success("文件已开始下载");
}

export function useDirectoryActions({
  fileLibraryId,
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
      mutationKey: [...LIBRARY_DOCUMENT_UPLOAD_KEY, fileLibraryId],
    }) > 0;

  const completeDocumentMutation = useMutation({
    mutationFn: (documentId: string) =>
      libraryDocumentsCompleteDocumentUpload({
        path: { document_id: documentId },
        throwOnError: true,
      }),
    onSuccess: () => {
      toast.success("文件上传已确认");
      onChanged({ type: "documents" });
    },
    onError: showDocumentActionError,
  });

  const downloadOriginalMutation = useMutation({
    mutationFn: downloadOriginalLibraryDocument,
    onSuccess: showDownloadStarted,
    onError: showDocumentActionError,
  });

  const [folderToEdit, setFolderToEdit] =
    useState<LibraryFolderPublic | null>();
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
        await fileLibrariesMoveFolder({
          path: { file_library_id: fileLibraryId, folder_id: entry.id },
          body: { parent_id: folderId },
          throwOnError: true,
        });
      } else {
        await libraryDocumentsMoveDocument({
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
      fileLibrariesDeleteDirectoryEntries({
        path: { file_library_id: fileLibraryId },
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
    downloadOriginalMutation,
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
    downloadOriginalMutation,
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
          {!entry.uploaded ? (
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
  currentFolder?: LibraryFolderPublic;
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
  fileLibraryId,
  currentFolderId,
  folders,
}: {
  actions: DirectoryActions;
  fileLibraryId: string;
  currentFolderId?: string;
  folders: LibraryFolderPublic[];
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
          kind="file"
          libraryId={fileLibraryId}
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
          ? "文件夹内的子文件夹和文件也会删除。"
          : null}
        原文件也会删除，此操作无法撤销。
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
          title={entryToMove.type === "folder" ? "移动文件夹" : "移动文件"}
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
