"use client";

import { FolderInputIcon, MoreHorizontalIcon, PencilIcon, TrashIcon } from "lucide-react";
import type { ReactEventHandler } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function FolderActions({
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
