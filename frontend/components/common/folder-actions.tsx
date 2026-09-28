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
  disabled = false,
  onTriggerInteraction,
  onMove,
  onRename,
  onDelete,
}: {
  name: string;
  variant: "outline" | "ghost";
  disabled?: boolean;
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
          disabled={disabled}
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
          <DropdownMenuItem disabled={disabled} onSelect={onMove}>
            <FolderInputIcon aria-hidden="true" />
            移动到
          </DropdownMenuItem>
          <DropdownMenuItem disabled={disabled} onSelect={onRename}>
            <PencilIcon aria-hidden="true" />
            重命名
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" disabled={disabled} onSelect={onDelete}>
            <TrashIcon aria-hidden="true" />
            删除
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
