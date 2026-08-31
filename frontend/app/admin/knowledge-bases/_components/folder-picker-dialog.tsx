"use client";

import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  FolderIcon,
  FolderOpenIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { getApiErrorMessage } from "@/lib/api-error";
import type { KnowledgeFolderPublic } from "@/lib/client";
import { getFolderAncestors } from "@/lib/knowledge-folders";

type KnowledgeFolderPickerDialogProps = {
  onClose: () => void;
  onCloseAutoFocus: (event: Event) => void;
  folders: KnowledgeFolderPublic[];
  currentFolderId: string | null;
  excludedFolderId?: string;
  title: string;
  description: string;
  isPending: boolean;
  error: Error | null;
  onMove: (folderId: string | null) => void;
};

type FolderNode = {
  id: string | null;
  parentId: string | null;
  name: string;
  path: string;
  current: boolean;
  disabled: boolean;
  defaultOpen: boolean;
  children: FolderNode[];
};

type FolderNodeProps = {
  node: FolderNode;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  isPending: boolean;
  visibleIds?: ReadonlySet<string | null>;
};

export function KnowledgeFolderPickerDialog({
  onClose,
  onCloseAutoFocus,
  folders,
  currentFolderId,
  excludedFolderId,
  title,
  description,
  isPending,
  error,
  onMove,
}: KnowledgeFolderPickerDialogProps) {
  const { root, nodes } = useMemo(() => {
    const folderById = new Map(folders.map((folder) => [folder.id, folder]));

    const currentPath = new Set(
      getFolderAncestors(folderById, currentFolderId ?? undefined).map(
        (folder) => folder.id,
      ),
    );

    const root: FolderNode = {
      id: null,
      parentId: null,
      name: "知识库根目录",
      path: "知识库根目录",
      current: currentFolderId === null,
      disabled: currentFolderId === null,
      defaultOpen: true,
      children: [],
    };

    const nodes = new Map<string | null, FolderNode>([[null, root]]);

    for (const folder of folders) {
      const ancestors = getFolderAncestors(folderById, folder.id);

      nodes.set(folder.id, {
        id: folder.id,
        parentId: folder.parent_id,
        name: folder.name,
        path: ancestors.map((ancestor) => ancestor.name).join(" / "),
        current: folder.id === currentFolderId,
        disabled:
          folder.id === currentFolderId ||
          ancestors.some((ancestor) => ancestor.id === excludedFolderId),
        defaultOpen: currentPath.has(folder.id),
        children: [],
      });
    }

    for (const folder of [...folders].sort((a, b) =>
      a.name.localeCompare(b.name, "zh-CN"),
    )) {
      const parent = nodes.get(folder.parent_id);

      if (!parent) {
        throw new Error("文件夹数据不一致：父文件夹不存在");
      }

      parent.children.push(nodes.get(folder.id)!);
    }

    return { root, nodes };
  }, [folders, currentFolderId, excludedFolderId]);

  const [search, setSearch] = useState("");

  const visibleIds = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("zh-CN");

    if (!query) return undefined;

    const matches = new Set<string | null>();

    for (const node of nodes.values()) {
      if (!node.path.toLocaleLowerCase("zh-CN").includes(query)) continue;

      let ancestor: FolderNode | undefined = node;

      while (ancestor) {
        matches.add(ancestor.id);
        ancestor =
          ancestor.id === null ? undefined : nodes.get(ancestor.parentId);
      }
    }

    return matches;
  }, [nodes, search]);

  const [selectedFolderId, setSelectedFolderId] = useState(currentFolderId);

  const selectedNode = nodes.get(selectedFolderId);
  const canMove = selectedNode !== undefined && !selectedNode.disabled;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !isPending) onClose();
      }}
    >
      <DialogContent
        showCloseButton={!isPending}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <Field data-disabled={isPending}>
          <FieldLabel htmlFor="folder-picker-search" className="sr-only">
            搜索文件夹
          </FieldLabel>
          <Input
            id="folder-picker-search"
            name="folder-search"
            type="search"
            autoComplete="off"
            placeholder="搜索文件夹…"
            value={search}
            disabled={isPending}
            onChange={(event) => {
              setSearch(event.currentTarget.value);
              setSelectedFolderId(currentFolderId);
            }}
          />
        </Field>

        {visibleIds?.size === 0 ? (
          <Empty role="status">
            <EmptyHeader>
              <EmptyTitle>未找到文件夹</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="max-h-72 overflow-y-auto" aria-label="目标文件夹">
            <FolderTreeNode
              node={root}
              selectedId={selectedFolderId}
              onSelect={setSelectedFolderId}
              isPending={isPending}
              visibleIds={visibleIds}
            />
          </ul>
        )}

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>{getApiErrorMessage(error, "移动失败")}</AlertTitle>
          </Alert>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={onClose}
          >
            取消
          </Button>
          <Button
            type="button"
            disabled={isPending || !canMove}
            onClick={() => onMove(selectedFolderId)}
          >
            {isPending ? <Spinner data-icon="inline-start" /> : null}
            移动
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FolderTreeNode(props: FolderNodeProps) {
  const { node, selectedId, onSelect, isPending, visibleIds } = props;
  const [expanded, setExpanded] = useState(node.defaultOpen);

  const searching = visibleIds !== undefined;
  const open = searching || expanded;
  const hasChildren = node.children.length > 0;

  if (visibleIds && !visibleIds.has(node.id)) return null;

  return (
    <Collapsible
      asChild
      open={open}
      onOpenChange={setExpanded}
      disabled={isPending}
    >
      <li>
        <div className="flex items-center">
          {hasChildren ? (
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={searching || isPending}
                aria-label={`${open ? "收起" : "展开"}${node.name}`}
              >
                {open ? (
                  <ChevronDownIcon aria-hidden="true" />
                ) : (
                  <ChevronRightIcon aria-hidden="true" />
                )}
              </Button>
            </CollapsibleTrigger>
          ) : (
            <span className="size-8 shrink-0" aria-hidden="true" />
          )}
          <Button
            type="button"
            variant={selectedId === node.id ? "secondary" : "ghost"}
            size="sm"
            className="min-w-0 flex-1 justify-start"
            disabled={isPending || node.disabled}
            aria-label={node.path}
            aria-pressed={selectedId === node.id}
            title={node.path}
            onClick={() => onSelect(node.id)}
          >
            {hasChildren && open ? (
              <FolderOpenIcon data-icon="inline-start" aria-hidden="true" />
            ) : (
              <FolderIcon data-icon="inline-start" aria-hidden="true" />
            )}
            <span className="truncate">{node.name}</span>
            {node.current ? (
              <Badge className="ml-auto" variant="secondary">
                当前位置
              </Badge>
            ) : selectedId === node.id ? (
              <CheckIcon
                className="ml-auto"
                data-icon="inline-end"
                aria-hidden="true"
              />
            ) : null}
          </Button>
        </div>
        {hasChildren ? (
          <CollapsibleContent asChild>
            <ul className="pl-4">
              {node.children.map((child) => (
                <FolderTreeNode key={child.id} {...props} node={child} />
              ))}
            </ul>
          </CollapsibleContent>
        ) : null}
      </li>
    </Collapsible>
  );
}
