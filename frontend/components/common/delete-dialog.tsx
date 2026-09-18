"use client";

import type { ReactNode } from "react";

import { ButtonContent } from "@/components/common/button-content";
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
            disabled={pending}
            aria-busy={pending}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            <ButtonContent loading={pending}>删除</ButtonContent>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
