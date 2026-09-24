"use client";

import { type FormEvent, useState } from "react";

import { FormDialogFooter } from "@/components/common/form-dialog-footer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function NameDialog({
  title,
  description,
  submitLabel,
  initialName = "",
  isPending,
  onSubmit,
  onClose,
  onCloseAutoFocus,
}: {
  title: string;
  description: string;
  submitLabel: string;
  initialName?: string;
  isPending: boolean;
  onSubmit: (name: string) => void;
  onClose: () => void;
  onCloseAutoFocus?: (event: Event) => void;
}) {
  const [name, setName] = useState(initialName);

  function submitName(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (isPending || !name.trim()) return;

    onSubmit(name.trim());
  }

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

        <form onSubmit={submitName}>
          <FieldGroup>
            <Field data-disabled={isPending}>
              <FieldLabel htmlFor="entry-name">名称</FieldLabel>
              <Input
                id="entry-name"
                name="name"
                value={name}
                maxLength={100}
                required
                autoComplete="off"
                autoFocus
                disabled={isPending}
                onChange={(event) => setName(event.currentTarget.value)}
              />
            </Field>

            <FormDialogFooter
              isPending={isPending}
              disabled={!name.trim()}
              submitLabel={submitLabel}
            />
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
