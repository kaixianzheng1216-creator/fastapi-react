"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
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
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  type KnowledgeBasePublic,
  knowledgeBasesCreateKnowledgeBase,
  knowledgeBasesUpdateKnowledgeBase,
} from "@/lib/client";

const knowledgeBaseSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "请输入知识库名称")
    .max(100, "知识库名称最多 100 个字符"),
  description: z.string().trim().max(500, "描述最多 500 个字符"),
});

type KnowledgeBaseValues = z.infer<typeof knowledgeBaseSchema>;

type KnowledgeBaseDialogProps = {
  open: boolean;
  knowledgeBase?: KnowledgeBasePublic;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

export function KnowledgeBaseDialog({
  open,
  knowledgeBase,
  onOpenChange,
  onSaved,
}: KnowledgeBaseDialogProps) {
  const isEditing = knowledgeBase !== undefined;
  const form = useForm<KnowledgeBaseValues>({
    resolver: zodResolver(knowledgeBaseSchema),
    defaultValues: {
      name: knowledgeBase?.name ?? "",
      description: knowledgeBase?.description ?? "",
    },
  });

  const saveKnowledgeBase = useMutation({
    mutationFn: async (values: KnowledgeBaseValues): Promise<void> => {
      if (knowledgeBase) {
        await knowledgeBasesUpdateKnowledgeBase({
          path: { knowledge_base_id: knowledgeBase.id },
          body: {
            name: values.name,
            description: values.description || null,
          },
          throwOnError: true,
        });
        return;
      }

      await knowledgeBasesCreateKnowledgeBase({
        body: {
          name: values.name,
          description: values.description || null,
        },
        throwOnError: true,
      });
    },
  });

  const requestError = saveKnowledgeBase.error
    ? getApiErrorMessage(
        saveKnowledgeBase.error,
        isEditing ? "更新知识库失败" : "创建知识库失败",
      )
    : "";

  function handleOpenChange(nextOpen: boolean): void {
    if (!nextOpen && saveKnowledgeBase.isPending) {
      return;
    }

    if (!nextOpen) {
      saveKnowledgeBase.reset();
      form.reset();
    }

    onOpenChange(nextOpen);
  }

  function submitKnowledgeBase(values: KnowledgeBaseValues): void {
    saveKnowledgeBase.mutate(values, {
      onSuccess: () => {
        form.reset();
        onOpenChange(false);
        onSaved();
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={!saveKnowledgeBase.isPending}>
        <DialogHeader>
          <DialogTitle>{isEditing ? "编辑知识库" : "创建知识库"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "更新知识库名称和描述。"
              : "新知识库创建后默认为停用状态。"}
          </DialogDescription>
        </DialogHeader>

        <form noValidate onSubmit={form.handleSubmit(submitKnowledgeBase)}>
          <FieldGroup>
            <Field data-invalid={!!form.formState.errors.name}>
              <FieldLabel htmlFor="knowledge-base-name">名称</FieldLabel>
              <Input
                id="knowledge-base-name"
                autoComplete="off"
                aria-invalid={!!form.formState.errors.name}
                {...form.register("name")}
              />
              <FieldError errors={[form.formState.errors.name]} />
            </Field>

            <Field data-invalid={!!form.formState.errors.description}>
              <FieldLabel htmlFor="knowledge-base-description">描述</FieldLabel>
              <Textarea
                id="knowledge-base-description"
                aria-invalid={!!form.formState.errors.description}
                {...form.register("description")}
              />
              <FieldError errors={[form.formState.errors.description]} />
            </Field>

            <FieldError>{requestError}</FieldError>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={saveKnowledgeBase.isPending}
                onClick={() => handleOpenChange(false)}
              >
                取消
              </Button>
              <Button type="submit" disabled={saveKnowledgeBase.isPending}>
                {saveKnowledgeBase.isPending && (
                  <Spinner data-icon="inline-start" />
                )}
                {isEditing ? "保存" : "创建知识库"}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
