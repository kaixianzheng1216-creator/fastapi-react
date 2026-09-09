"use client";

import { useQuery } from "@tanstack/react-query";
import { ModelSelector } from "@/app/(authenticated)/_components/model-selector";
import { Skeleton } from "@/components/ui/skeleton";
import { agentReadModels } from "@/lib/client";

const THINKING_OPTIONS = [
  { id: "disabled", name: "关闭" },
  { id: "enabled", name: "开启" },
] as const;

export function ComposerModelSelector() {
  const modelsQuery = useQuery({
    queryKey: ["models"],
    queryFn: async () => {
      const { data } = await agentReadModels({
        throwOnError: true,
      });

      return data;
    },
    staleTime: Infinity,
  });

  if (modelsQuery.isPending) {
    return (
      <Skeleton
        role="status"
        aria-label="正在加载模型"
        className="h-8 w-24 rounded-md"
      />
    );
  }

  if (!modelsQuery.data?.data.length)
    return (
      <span className="text-muted-foreground text-xs">暂无可用模型</span>
    );

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
