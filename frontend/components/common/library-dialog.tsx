"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { ButtonLoading } from "@/components/common/button-loading";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { getApiErrorMessage } from "@/lib/api-error";
import {
  fileLibrariesCreateFileLibrary,
  fileLibrariesUpdateFileLibrary,
  knowledgeBasesCreateKnowledgeBase,
  knowledgeBasesUpdateKnowledgeBase,
} from "@/lib/client";
import { toast } from "sonner";

const librarySchema = z.object({
  name: z.string().trim().min(1, "请输入名称").max(100, "名称最多 100 个字符"),
  description: z.string().trim().max(500, "描述最多 500 个字符"),
});

type LibraryValues = z.infer<typeof librarySchema>;

type LibraryDialogProps = {
  open: boolean;
  kind: "file" | "knowledge";
  library?: { id: string; name: string; description: string | null };
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

export function LibraryDialog({
  open,
  kind,
  library,
  onOpenChange,
  onSaved,
}: LibraryDialogProps) {
  const label = kind === "file" ? "文件库" : "知识库";
  const isEditing = library !== undefined;

  const form = useForm<LibraryValues>({
    resolver: zodResolver(librarySchema),
    defaultValues: {
      name: library?.name ?? "",
      description: library?.description ?? "",
    },
  });

  const saveLibraryMutation = useMutation({
    mutationFn: async (values: LibraryValues): Promise<void> => {
      const body = {
        name: values.name,
        description: values.description || null,
      };
      if (kind === "file") {
        if (library) {
          await fileLibrariesUpdateFileLibrary({
            path: { file_library_id: library.id },
            body,
            throwOnError: true,
          });
        } else {
          await fileLibrariesCreateFileLibrary({ body, throwOnError: true });
        }
      } else if (library) {
        await knowledgeBasesUpdateKnowledgeBase({
          path: { knowledge_base_id: library.id },
          body,
          throwOnError: true,
        });
      } else {
        await knowledgeBasesCreateKnowledgeBase({ body, throwOnError: true });
      }
    },

    onSuccess: () => {
      toast.success(`${label}已保存`);
      form.reset();
      onOpenChange(false);
      onSaved();
    },

    onError: (error) => {
      toast.error(getApiErrorMessage(error, `${label}保存失败，请重试`));
    },
  });

  function handleOpenChange(nextOpen: boolean): void {
    if (!nextOpen && saveLibraryMutation.isPending) {
      return;
    }

    if (!nextOpen) {
      form.reset();
    }

    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={!saveLibraryMutation.isPending}>
        <DialogHeader>
          <DialogTitle>{`${isEditing ? "编辑" : "创建"}${label}`}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? `更新${label}名称和描述。`
              : kind === "knowledge"
                ? "新知识库创建后默认为停用状态。"
                : "设置文件库名称和描述，创建后即可上传文件。"}
          </DialogDescription>
        </DialogHeader>

        <form
          noValidate
          onSubmit={form.handleSubmit((values) =>
            saveLibraryMutation.mutate(values),
          )}
        >
          <FieldGroup>
            <Field data-invalid={!!form.formState.errors.name}>
              <FieldLabel htmlFor="library-base-name">名称</FieldLabel>
              <Input
                disabled={saveLibraryMutation.isPending}
                id="library-base-name"
                autoComplete="off"
                aria-invalid={!!form.formState.errors.name}
                {...form.register("name")}
              />
              <FieldError errors={[form.formState.errors.name]} />
            </Field>

            <Field data-invalid={!!form.formState.errors.description}>
              <FieldLabel htmlFor="library-base-description">描述</FieldLabel>
              <Textarea
                disabled={saveLibraryMutation.isPending}
                id="library-base-description"
                aria-invalid={!!form.formState.errors.description}
                {...form.register("description")}
              />
              <FieldError errors={[form.formState.errors.description]} />
            </Field>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={saveLibraryMutation.isPending}
                onClick={() => handleOpenChange(false)}
              >
                取消
              </Button>
              <Button
                type="submit"
                className="relative"
                disabled={saveLibraryMutation.isPending}
                aria-busy={saveLibraryMutation.isPending}
              >
                <ButtonLoading loading={saveLibraryMutation.isPending}>
                  {isEditing ? "保存" : `创建${label}`}
                </ButtonLoading>
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
