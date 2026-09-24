"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  NameDescriptionDialog,
  type NameDescriptionValues,
} from "@/components/common/name-description-dialog";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  knowledgeBasesCreateKnowledgeBase,
  knowledgeBasesUpdateKnowledgeBase,
} from "@/lib/client";

export function LibraryDialog({
  library,
  onClose,
  onCloseAutoFocus,
  onSaved,
  projectId,
  projectName,
}: {
  library?: { id: string; name: string; description: string | null };
  onClose: () => void;
  onCloseAutoFocus?: (event: Event) => void;
  onSaved: () => void;
  projectId: string;
  projectName: string;
}) {
  const save = useMutation({
    mutationFn: async (values: NameDescriptionValues) => {
      const body = {
        name: values.name,
        description: values.description || null,
      };
      if (library)
        await knowledgeBasesUpdateKnowledgeBase({
          path: { knowledge_base_id: library.id },
          body,
          throwOnError: true,
        });
      else
        await knowledgeBasesCreateKnowledgeBase({
          body: { ...body, project_id: projectId },
          throwOnError: true,
        });
    },
    onSuccess: () => {
      toast.success("知识库已保存");
      onClose();
      onSaved();
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "知识库保存失败，请重试")),
  });

  return (
    <NameDescriptionDialog
      initialValues={library}
      title={library ? "编辑知识库" : "创建知识库"}
      description={
        `所属项目：${projectName}。` +
        (library ? "更新知识库名称和描述。" : "新知识库创建后默认为停用状态。")
      }
      submitLabel={library ? "保存" : "创建知识库"}
      isPending={save.isPending}
      onSubmit={save.mutate}
      onClose={onClose}
      onCloseAutoFocus={onCloseAutoFocus}
    />
  );
}
