"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { FormDialogFooter } from "@/components/common/form-dialog-footer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const detailsSchema = z.object({
  name: z.string().trim().min(1, "请输入名称").max(100, "名称最多 100 个字符"),
  description: z.string().trim().max(500, "描述最多 500 个字符"),
});

export type NameDescriptionValues = z.infer<typeof detailsSchema>;

type NameDescriptionDialogProps = {
  title: string;
  description: string;
  submitLabel: string;
  initialValues?: { name: string; description: string | null };
  isPending: boolean;
  onSubmit: (values: NameDescriptionValues) => void;
  onClose: () => void;
  onCloseAutoFocus?: (event: Event) => void;
};

export function NameDescriptionDialog({
  title,
  description,
  submitLabel,
  initialValues,
  isPending,
  onSubmit,
  onClose,
  onCloseAutoFocus,
}: NameDescriptionDialogProps) {
  const form = useForm<NameDescriptionValues>({
    resolver: zodResolver(detailsSchema),
    defaultValues: {
      name: initialValues?.name ?? "",
      description: initialValues?.description ?? "",
    },
  });

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !isPending) onClose();
      }}
    >
      <DialogContent
        onCloseAutoFocus={onCloseAutoFocus}
        showCloseButton={!isPending}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form
          noValidate
          onSubmit={form.handleSubmit((values) => {
            if (!isPending) onSubmit(values);
          })}
        >
          <FieldGroup>
            <Field data-invalid={!!form.formState.errors.name}>
              <FieldLabel htmlFor="details-name">名称</FieldLabel>
              <Input
                disabled={isPending}
                id="details-name"
                autoComplete="off"
                aria-invalid={!!form.formState.errors.name}
                {...form.register("name")}
              />
              <FieldError errors={[form.formState.errors.name]} />
            </Field>

            <Field data-invalid={!!form.formState.errors.description}>
              <FieldLabel htmlFor="details-description">描述</FieldLabel>
              <Textarea
                disabled={isPending}
                id="details-description"
                aria-invalid={!!form.formState.errors.description}
                {...form.register("description")}
              />
              <FieldError errors={[form.formState.errors.description]} />
            </Field>

            <FormDialogFooter isPending={isPending} submitLabel={submitLabel} />
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
