"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { LoginForm } from "@/app/login/_components/login-form";
import { ButtonContent } from "@/components/common/button-content";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  invitationsAcceptInvitation,
  invitationsReadInvitation,
} from "@/lib/client";
import { projectHref } from "@/lib/project-routes";

export function InvitationForm({ token }: { token: string }) {
  const router = useRouter();
  const client = useQueryClient();

  const query = useQuery({
    queryKey: ["invitation", token],
    meta: { handlesError: true },
    queryFn: async ({ signal }) => {
      const result = await invitationsReadInvitation({
        path: { token },
        signal,
      });

      if (result.response?.status === 404) return null;
      if (result.error) throw result.error;

      return result.data!;
    },
  });

  const join = useMutation({
    mutationFn: () =>
      invitationsAcceptInvitation({ path: { token }, throwOnError: true }),
    onSuccess: ({ data }) => {
      for (const key of [
        "projects",
        "project",
        "members",
        "member-candidates",
      ]) {
        void client.invalidateQueries({ queryKey: [key] });
      }

      toast.success(`已加入「${data.project_name}」`);
      router.replace(projectHref(data.project_id));
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "加入项目失败"));

      void query.refetch();
    },
  });

  const joining = join.isPending || join.isSuccess;

  if (query.isPending) {
    return (
      <div role="status" className="flex items-center justify-center gap-2">
        <Spinner aria-hidden="true" />
        <h1 id="login-heading" className="text-sm">
          正在加载邀请…
        </h1>
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="space-y-6 text-center">
        <h1 id="login-heading" className="text-2xl font-semibold">
          {query.isError ? "邀请加载失败" : "邀请链接不可用"}
        </h1>

        <p role="alert" className="text-sm text-muted-foreground">
          {query.isError
            ? getApiErrorMessage(query.error, "请稍后重试")
            : "链接无效或已过期，请联系项目管理员获取新链接"}
        </p>

        {query.isError ? (
          <Button
            variant="outline"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            <ButtonContent loading={query.isFetching}>重试</ButtonContent>
          </Button>
        ) : (
          <Button variant="outline" asChild>
            <Link href="/">返回首页</Link>
          </Button>
        )}
      </div>
    );
  }

  const invitation = query.data;

  if (!invitation.current_user_name) {
    return (
      <LoginForm
        title={`加入「${invitation.project_name}」`}
        description="登录后确认加入项目"
        returnTo={`/invite/${encodeURIComponent(token)}`}
      />
    );
  }

  return (
    <div className="space-y-6 text-center">
      <div className="space-y-1.5">
        <h1
          id="login-heading"
          className="break-words text-2xl font-semibold tracking-tight"
        >
          {invitation.is_member ? "进入" : "加入"}「{invitation.project_name}」
        </h1>

        <p className="break-words text-sm text-muted-foreground">
          当前登录：{invitation.current_user_name}
          <br />
          {invitation.is_member ? "你已是该项目成员" : "将以普通成员身份加入"}
        </p>
      </div>

      {invitation.is_member ? (
        <Button size="lg" className="w-full" asChild>
          <Link href={projectHref(invitation.project_id)}>进入项目</Link>
        </Button>
      ) : (
        <Button
          size="lg"
          className="w-full"
          disabled={joining}
          aria-busy={joining}
          onClick={() => join.mutate()}
        >
          <ButtonContent loading={joining}>加入项目</ButtonContent>
        </Button>
      )}
    </div>
  );
}
