import { PlusIcon, TrashIcon } from "lucide-react";
import type { ReactNode, SyntheticEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function DirectoryToolbar({
  selectedCount,
  disabled,
  deletePending,
  onDelete,
  onCreateFolder,
  onTriggerInteraction,
  children,
}: {
  selectedCount: number;
  disabled: boolean;
  deletePending: boolean;
  onDelete: () => void;
  onCreateFolder: () => void;
  onTriggerInteraction: (event: SyntheticEvent<HTMLButtonElement>) => void;
  children?: ReactNode;
}) {
  return (
    <fieldset
      disabled={disabled}
      className="flex min-w-0 flex-wrap items-center gap-2"
    >
      {selectedCount > 0 && (
        <>
          <Badge variant="secondary" aria-live="polite">
            已选择 {selectedCount} 项
          </Badge>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            aria-label={`删除已选择的 ${selectedCount} 项`}
            disabled={deletePending}
            onFocus={onTriggerInteraction}
            onPointerDown={onTriggerInteraction}
            onClick={onDelete}
          >
            <TrashIcon data-icon="inline-start" aria-hidden="true" />
            删除
          </Button>
        </>
      )}
      {children}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onCreateFolder}
        onFocus={onTriggerInteraction}
        onPointerDown={onTriggerInteraction}
      >
        <PlusIcon data-icon="inline-start" aria-hidden="true" />
        新建文件夹
      </Button>
    </fieldset>
  );
}
