"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  NameDescriptionDialog,
  type NameDescriptionValues,
} from "@/components/common/name-description-dialog";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  fileLibrariesCreateFileLibrary,
  fileLibrariesUpdateFileLibrary,
} from "@/lib/client";

export function LibraryDialog({
  library,
  onClose,
  onCloseAutoFocus,
  onSaved,
}: {
  library?: { id: string; name: string; description: string | null };
  onClose: () => void;
  onCloseAutoFocus?: (event: Event) => void;
  onSaved: () => void;
}) {
  const save = useMutation({
    mutationFn: async (values: NameDescriptionValues) => {
      const body = {
        name: values.name,
        description: values.description || null,
      };
      if (library)
        await fileLibrariesUpdateFileLibrary({
          path: { file_library_id: library.id },
          body,
          throwOnError: true,
        });
      else
        await fileLibrariesCreateFileLibrary({
          body: body,
          throwOnError: true,
        });
    },
    onSuccess: () => {
      toast.success("文件库已保存");
      onClose();
      onSaved();
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "文件库保存失败，请重试")),
  });

  return (
    <NameDescriptionDialog
      initialValues={library}
      title={library ? "编辑文件库" : "创建文件库"}
      description={
        library
          ? "更新文件库名称和描述。"
          : "设置文件库名称和描述，创建后即可上传文件。"
      }
      submitLabel={library ? "保存" : "创建文件库"}
      isPending={save.isPending}
      onSubmit={save.mutate}
      onClose={onClose}
      onCloseAutoFocus={onCloseAutoFocus}
    />
  );
}
