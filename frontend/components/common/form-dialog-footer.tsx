"use client";

import { Button } from "@/components/ui/button";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";
import { ButtonContent } from "@/components/common/button-content";

export function FormDialogFooter({
  isPending,
  disabled,
  submitLabel,
}: {
  isPending: boolean;
  disabled?: boolean;
  submitLabel: string;
}) {
  return (
    <DialogFooter>
      <DialogClose asChild>
        <Button type="button" variant="outline" disabled={isPending}>
          取消
        </Button>
      </DialogClose>
      <Button
        type="submit"
        disabled={isPending || disabled}
        aria-busy={isPending}
      >
        <ButtonContent loading={isPending}>{submitLabel}</ButtonContent>
      </Button>
    </DialogFooter>
  );
}
