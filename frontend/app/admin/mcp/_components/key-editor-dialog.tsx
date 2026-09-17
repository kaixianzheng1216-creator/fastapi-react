"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { ButtonLoading } from "@/components/common/button-loading";
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
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  mcpKeysCreateMcpApiKey,
  mcpKeysUpdateMcpApiKey,
  type McpApiKeyCreated,
  type McpApiKeyPublic,
  type McpScope,
} from "@/lib/client";

const keySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "请输入密钥名称")
    .max(100, "名称最多 100 个字符"),
  isActive: z.boolean(),
});

type KeyValues = z.infer<typeof keySchema>;

type KeyEditorDialogProps = {
  scope: McpScope;
  apiKey?: McpApiKeyPublic;
  onClose: () => void;
  onSaved: (createdKey?: McpApiKeyCreated) => void;
};

export function KeyEditorDialog({
  scope,
  apiKey,
  onClose,
  onSaved,
}: KeyEditorDialogProps) {
  const form = useForm<KeyValues>({
    resolver: zodResolver(keySchema),
    defaultValues: {
      name: apiKey?.name ?? "",
      isActive: apiKey?.is_active ?? true,
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
          body: { name: values.name, is_active: values.isActive },
          throwOnError: true,
        });

        return;
      }

      const { data } = await mcpKeysCreateMcpApiKey({
        body: { name: values.name, scope },
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
      <DialogContent showCloseButton={!saveMutation.isPending}>
        <DialogHeader>
          <DialogTitle>{apiKey ? "编辑密钥" : "创建密钥"}</DialogTitle>
          <DialogDescription>
            {apiKey
              ? "修改名称或启用状态，停用后将拒绝新的连接请求。"
              : `${scope === "internal" ? "内部密钥可查询和管理数据" : "外部密钥仅可查询数据"}。完整密钥仅在创建后显示一次，请妥善保存。`}
          </DialogDescription>
        </DialogHeader>

        <form
          noValidate
          onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
        >
          <FieldGroup>
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

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={saveMutation.isPending}
              >
                取消
              </Button>

              <Button
                type="submit"
                className="relative"
                disabled={saveMutation.isPending}
                aria-busy={saveMutation.isPending}
              >
                <ButtonLoading loading={saveMutation.isPending}>
                  {apiKey ? "保存" : "创建密钥"}
                </ButtonLoading>
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
