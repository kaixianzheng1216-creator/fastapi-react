"use client";

import { useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/lib/api-error";
import { skillsCreateMdSkill, skillsCreateZipSkill } from "@/lib/client";

type SkillCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
};

const markdownSkillSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "请输入技能名称")
    .max(64, "名称最多 64 个字符")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "仅允许小写字母、数字和连字符"),
  description: z
    .string()
    .trim()
    .min(1, "请输入技能描述")
    .max(1024, "描述最多 1024 个字符"),
  content: z.string().min(1, "请输入技能正文"),
});

const zipSkillSchema = z.object({
  skillZip: z.custom<FileList>(
    (value) => value instanceof FileList && value.length > 0,
    "请选择 ZIP 文件",
  ),
});

type MarkdownSkillValues = z.infer<typeof markdownSkillSchema>;
type ZipSkillValues = z.infer<typeof zipSkillSchema>;

export function SkillCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: SkillCreateDialogProps) {
  const markdownForm = useForm<MarkdownSkillValues>({
    resolver: zodResolver(markdownSkillSchema),
  });
  const zipForm = useForm<ZipSkillValues>({
    resolver: zodResolver(zipSkillSchema),
  });

  const createMarkdownMutation = useMutation({
    mutationFn: async (body: MarkdownSkillValues): Promise<void> => {
      await skillsCreateMdSkill({ body, throwOnError: true });
    },
  });

  const createZipMutation = useMutation({
    mutationFn: async (skillZip: File): Promise<void> => {
      await skillsCreateZipSkill({
        body: { skill_zip: skillZip },
        throwOnError: true,
      });
    },
  });

  const isSubmitting =
    createMarkdownMutation.isPending || createZipMutation.isPending;
  const markdownRequestError = createMarkdownMutation.error
    ? getApiErrorMessage(createMarkdownMutation.error, "创建技能失败")
    : "";
  const zipRequestError = createZipMutation.error
    ? getApiErrorMessage(createZipMutation.error, "上传技能失败")
    : "";

  function clearCreateErrors(): void {
    createMarkdownMutation.reset();
    createZipMutation.reset();
    markdownForm.clearErrors();
    zipForm.clearErrors();
  }

  function handleOpenChange(nextOpen: boolean): void {
    if (!nextOpen && isSubmitting) {
      return;
    }

    if (!nextOpen) {
      clearCreateErrors();
    }

    onOpenChange(nextOpen);
  }

  function handleCreateSuccess(): void {
    markdownForm.reset();
    zipForm.reset();
    clearCreateErrors();
    onOpenChange(false);
    onCreated();
  }

  function submitMarkdownSkill(values: MarkdownSkillValues): void {
    createMarkdownMutation.mutate(
      {
        name: values.name,
        description: values.description,
        content: values.content,
      },
      { onSuccess: handleCreateSuccess },
    );
  }

  function submitZipSkill(values: ZipSkillValues): void {
    createZipMutation.mutate(values.skillZip[0], {
      onSuccess: handleCreateSuccess,
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl"
        showCloseButton={!isSubmitting}
      >
        <DialogHeader>
          <DialogTitle>创建技能</DialogTitle>
          <DialogDescription>
            填写 SKILL.md 正文，或上传已有的技能 ZIP 压缩包。
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="markdown">
          <TabsList>
            <TabsTrigger value="markdown">Markdown 创建</TabsTrigger>
            <TabsTrigger value="zip">ZIP 上传</TabsTrigger>
          </TabsList>

          <TabsContent value="markdown">
            <form
              noValidate
              onSubmit={markdownForm.handleSubmit(submitMarkdownSkill)}
            >
              <FieldGroup>
                <Field data-invalid={!!markdownForm.formState.errors.name}>
                  <FieldLabel htmlFor="skill-name">名称</FieldLabel>
                  <Input
                    id="skill-name"
                    maxLength={64}
                    placeholder="meeting-summary"
                    autoComplete="off"
                    spellCheck={false}
                    aria-invalid={!!markdownForm.formState.errors.name}
                    {...markdownForm.register("name")}
                  />
                  <FieldError errors={[markdownForm.formState.errors.name]} />
                </Field>

                <Field
                  data-invalid={!!markdownForm.formState.errors.description}
                >
                  <FieldLabel htmlFor="skill-description">描述</FieldLabel>
                  <Input
                    id="skill-description"
                    maxLength={1024}
                    placeholder="整理会议结论和后续行动项"
                    autoComplete="off"
                    aria-invalid={!!markdownForm.formState.errors.description}
                    {...markdownForm.register("description")}
                  />
                  <FieldError
                    errors={[markdownForm.formState.errors.description]}
                  />
                </Field>

                <Field data-invalid={!!markdownForm.formState.errors.content}>
                  <FieldLabel htmlFor="skill-content">正文</FieldLabel>
                  <Textarea
                    id="skill-content"
                    className="min-h-56 font-mono"
                    placeholder={
                      "# 会议纪要整理\n\n总结会议结论，提取行动项、负责人和截止时间。"
                    }
                    aria-invalid={!!markdownForm.formState.errors.content}
                    {...markdownForm.register("content")}
                  />
                  <FieldError
                    errors={[markdownForm.formState.errors.content]}
                  />
                </Field>

                <FieldError>{markdownRequestError}</FieldError>

                <DialogFooter>
                  <DialogClose asChild>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isSubmitting}
                    >
                      取消
                    </Button>
                  </DialogClose>
                  <Button type="submit" disabled={isSubmitting}>
                    {createMarkdownMutation.isPending && (
                      <Spinner data-icon="inline-start" />
                    )}
                    创建技能
                  </Button>
                </DialogFooter>
              </FieldGroup>
            </form>
          </TabsContent>

          <TabsContent value="zip">
            <form noValidate onSubmit={zipForm.handleSubmit(submitZipSkill)}>
              <FieldGroup>
                <Field data-invalid={!!zipForm.formState.errors.skillZip}>
                  <FieldLabel htmlFor="skill-zip">ZIP 压缩包</FieldLabel>
                  <Input
                    id="skill-zip"
                    type="file"
                    accept=".zip"
                    aria-invalid={!!zipForm.formState.errors.skillZip}
                    {...zipForm.register("skillZip")}
                  />
                  <FieldDescription>
                    压缩包不超过 10 MiB，并且包含一个有效的 SKILL.md。
                  </FieldDescription>
                  <FieldError errors={[zipForm.formState.errors.skillZip]} />
                </Field>

                <FieldError>{zipRequestError}</FieldError>

                <DialogFooter>
                  <DialogClose asChild>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isSubmitting}
                    >
                      取消
                    </Button>
                  </DialogClose>
                  <Button type="submit" disabled={isSubmitting}>
                    {createZipMutation.isPending && (
                      <Spinner data-icon="inline-start" />
                    )}
                    上传技能
                  </Button>
                </DialogFooter>
              </FieldGroup>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
