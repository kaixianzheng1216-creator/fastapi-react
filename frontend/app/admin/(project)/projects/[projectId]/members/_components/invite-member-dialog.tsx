"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CopyIcon } from "lucide-react";
import { toast } from "sonner";

import { FormDialogFooter } from "@/components/common/form-dialog-footer";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getApiErrorMessage } from "@/lib/api-error";
import { projectsCreateInvitation, type ProjectPublic } from "@/lib/client";

export function InviteMemberDialog({
  project,
}: {
  project: Pick<ProjectPublic, "id" | "name">;
}) {
  const [open, setOpen] = useState(false);
  const [duration, setDuration] = useState("7");

  const create = useMutation({
    mutationFn: (expiresInDays: number) =>
      projectsCreateInvitation({
        path: { project_id: project.id },
        body: { expires_in_days: expiresInDays },
        throwOnError: true,
      }),
    onError: (error) => toast.error(getApiErrorMessage(error, "创建邀请失败")),
  });

  const invitation = create.data?.data;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (create.isPending) return;

        setOpen(next);

        if (next) {
          setDuration("7");
          create.reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          邀请成员
        </Button>
      </DialogTrigger>

      <DialogContent showCloseButton={!create.isPending}>
        <DialogHeader className="min-w-0">
          <DialogTitle>
            {invitation ? "邀请链接已创建" : "邀请成员"}
          </DialogTitle>

          <DialogDescription className="break-words">
            {invitation
              ? "有效期内可供多人加入"
              : `邀请他人加入「${project.name}」`}
          </DialogDescription>
        </DialogHeader>

        {invitation ? (
          <>
            <Field>
              <FieldLabel htmlFor="invitation-url">邀请链接</FieldLabel>

              <div className="flex gap-2">
                <Input
                  id="invitation-url"
                  autoFocus
                  readOnly
                  value={invitation.url}
                  onFocus={(event) => event.target.select()}
                />

                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(invitation.url);

                      toast.success("已复制");
                    } catch {
                      toast.error("复制失败，请手动复制链接");
                    }
                  }}
                >
                  <CopyIcon data-icon="inline-start" aria-hidden="true" />
                  复制
                </Button>
              </div>

              <FieldDescription>
                到期时间：
                {new Date(invitation.expires_at).toLocaleString("zh-CN")}
              </FieldDescription>
            </Field>

            <DialogFooter>
              <DialogClose asChild>
                <Button>完成</Button>
              </DialogClose>
            </DialogFooter>
          </>
        ) : (
          <form
            className="space-y-6"
            onSubmit={(event) => {
              event.preventDefault();

              if (create.isPending) return;

              const days =
                duration === "custom"
                  ? new FormData(event.currentTarget).get("expires_in_days")
                  : duration;

              create.mutate(Number(days));
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="invitation-duration">有效期</FieldLabel>

                <Select
                  value={duration}
                  onValueChange={setDuration}
                  disabled={create.isPending}
                >
                  <SelectTrigger id="invitation-duration">
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="7">7 天</SelectItem>
                    <SelectItem value="30">30 天</SelectItem>
                    <SelectItem value="custom">自定义</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              {duration === "custom" && (
                <Field>
                  <FieldLabel htmlFor="invitation-days">有效天数</FieldLabel>

                  <Input
                    id="invitation-days"
                    name="expires_in_days"
                    type="number"
                    min={1}
                    max={30}
                    step={1}
                    required
                    aria-describedby="invitation-days-help"
                    disabled={create.isPending}
                  />

                  <FieldDescription id="invitation-days-help">
                    请输入 1–30 天的整数
                  </FieldDescription>
                </Field>
              )}
            </FieldGroup>

            <FormDialogFooter
              isPending={create.isPending}
              submitLabel="创建链接"
            />
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
