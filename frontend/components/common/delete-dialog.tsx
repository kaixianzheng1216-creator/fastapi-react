"use client";

import type { ReactNode } from "react";

import { ButtonLoading } from "@/components/common/button-loading";
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

type DeleteDialogProps = {
  open: boolean;
  pending: boolean;
  title: string;
  children: ReactNode;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCloseAutoFocus?: (event: Event) => void;
};

export function DeleteDialog({
  open,
  pending,
  title,
  children,
  onOpenChange,
  onConfirm,
  onCloseAutoFocus,
}: DeleteDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!pending) onOpenChange(nextOpen);
      }}
    >
      <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{children}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>取消</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            className="relative"
            disabled={pending}
            aria-busy={pending}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            <ButtonLoading loading={pending}>删除</ButtonLoading>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
