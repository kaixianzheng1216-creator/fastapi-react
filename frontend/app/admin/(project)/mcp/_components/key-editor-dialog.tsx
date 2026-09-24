"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
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
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Switch } from "@/components/ui/switch";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  mcpKeysCreateMcpApiKey,
  mcpKeysUpdateMcpApiKey,
  type McpApiKeyCreated,
  type McpApiKeyPublic,
} from "@/lib/client";

const keySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "请输入密钥名称")
    .max(100, "名称最多 100 个字符"),
  isActive: z.boolean(),
  permission: z.enum(["read_only", "read_write"]),
});

type KeyValues = z.infer<typeof keySchema>;

type KeyEditorDialogProps = {
  project: { id: string; name: string };
  apiKey?: McpApiKeyPublic;
  onClose: () => void;
  onCloseAutoFocus?: (event: Event) => void;
  onSaved: (createdKey?: McpApiKeyCreated) => void;
};

export function KeyEditorDialog({
  project,
  apiKey,
  onClose,
  onCloseAutoFocus,
  onSaved,
}: KeyEditorDialogProps) {
  const form = useForm<KeyValues>({
    resolver: zodResolver(keySchema),
    defaultValues: {
      name: apiKey?.name ?? "",
      isActive: apiKey?.is_active ?? true,
      permission: apiKey?.permission ?? "read_only",
    },
  });

  const saveMutation = useMutation({
    gcTime: 0,
    mutationFn: async (
      values: KeyValues,
    ): Promise<McpApiKeyCreated | undefined> => {
      if (apiKey) {
        await mcpKeysUpdateMcpApiKey({
          path: { key_id: apiKey.id },
          body: {
            name: values.name,
            is_active: values.isActive,
            permission: values.permission,
          },
          throwOnError: true,
        });

        return;
      }

      const { data } = await mcpKeysCreateMcpApiKey({
        body: {
          name: values.name,
          project_id: project.id,
          permission: values.permission,
        },
        throwOnError: true,
      });

      return data;
    },

    onSuccess: (createdKey) => {
      toast.success(apiKey ? "密钥已更新" : "密钥已创建");

      onSaved(createdKey);
    },

    onError: (error) =>
      toast.error(getApiErrorMessage(error, "密钥保存失败，请重试")),
  });

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saveMutation.isPending) onClose();
      }}
    >
      <DialogContent
        onCloseAutoFocus={onCloseAutoFocus}
        showCloseButton={!saveMutation.isPending}
      >
        <DialogHeader>
          <DialogTitle>{apiKey ? "编辑密钥" : "创建密钥"}</DialogTitle>
          <DialogDescription>
            {apiKey
              ? "修改密钥设置，停用后将无法连接。"
              : "完整密钥仅显示一次，请创建后复制保存。"}
          </DialogDescription>
        </DialogHeader>

        <form
          noValidate
          onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
        >
          <FieldGroup>
            <FieldDescription>项目：{project.name}</FieldDescription>
            <Field data-invalid={!!form.formState.errors.name}>
              <FieldLabel htmlFor="mcp-key-name">名称</FieldLabel>
              <Input
                id="mcp-key-name"
                autoComplete="off"
                disabled={saveMutation.isPending}
                aria-invalid={!!form.formState.errors.name}
                {...form.register("name")}
              />
              <FieldError errors={[form.formState.errors.name]} />
            </Field>

            <Controller
              name="permission"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel>访问权限</FieldLabel>
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    value={field.value}
                    disabled={saveMutation.isPending}
                    onValueChange={(value) => {
                      if (value) field.onChange(value);
                    }}
                    aria-label="密钥权限"
                  >
                    <ToggleGroupItem value="read_only">只读</ToggleGroupItem>
                    <ToggleGroupItem value="read_write">读写</ToggleGroupItem>
                  </ToggleGroup>
                  <FieldDescription>
                    只读仅开放知识库列表和检索；读写可使用全部知识库及业务数据工具。
                  </FieldDescription>
                </Field>
              )}
            />
            {apiKey && (
              <Controller
                name="isActive"
                control={form.control}
                render={({ field }) => (
                  <Field
                    orientation="horizontal"
                    data-disabled={saveMutation.isPending}
                  >
                    <FieldContent>
                      <FieldLabel htmlFor="mcp-key-active">启用密钥</FieldLabel>
                      <FieldDescription>
                        停用后可随时重新启用。
                      </FieldDescription>
                    </FieldContent>
                    <Switch
                      id="mcp-key-active"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={saveMutation.isPending}
                    />
                  </Field>
                )}
              />
            )}

            <FormDialogFooter
              isPending={saveMutation.isPending}
              submitLabel={apiKey ? "保存" : "创建密钥"}
            />
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
