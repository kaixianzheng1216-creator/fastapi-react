"use client";

import { useQuery } from "@tanstack/react-query";
import { ModelSelector } from "@/app/(authenticated)/_components/model-selector";
import { ButtonContent } from "@/components/common/button-content";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { agentReadModels } from "@/lib/client";
import { getQueryViewState } from "@/lib/query-view-state";

const THINKING_OPTIONS = [
  { id: "disabled", name: "关闭" },
  { id: "enabled", name: "开启" },
] as const;

export function ComposerModelSelector() {
  const modelsQuery = useQuery({
    meta: { handlesInitialError: true },
    queryKey: ["models"],
    queryFn: async () => {
      const { data } = await agentReadModels({
        throwOnError: true,
      });

      return data;
    },
    staleTime: Infinity,
  });

  const viewState = getQueryViewState(modelsQuery);

  if (viewState === "loading") {
    return (
      <Skeleton
        role="status"
        aria-label="正在加载模型"
        className="h-8 w-24 rounded-md"
      />
    );
  }

  if (viewState === "error") {
    return (
      <div role="alert" className="flex items-center gap-2">
        <span className="text-muted-foreground text-xs">模型暂不可用</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-disabled={modelsQuery.isFetching}
          aria-busy={modelsQuery.isFetching}
          onClick={() => {
            if (!modelsQuery.isFetching) void modelsQuery.refetch();
          }}
        >
          <ButtonContent loading={modelsQuery.isFetching}>重试</ButtonContent>
        </Button>
      </div>
    );
  }

  if (!modelsQuery.data?.data.length)
    return <span className="text-muted-foreground text-xs">暂无可用模型</span>;

  return (
    <ModelSelector
      models={modelsQuery.data.data.map(({ id, supportsThinking }) => ({
        id,
        name: id,
        efforts: supportsThinking ? THINKING_OPTIONS : undefined,
      }))}
      defaultValue={modelsQuery.data.defaultModel}
      defaultEffort="disabled"
      variant="ghost"
      size="sm"
    />
  );
}
