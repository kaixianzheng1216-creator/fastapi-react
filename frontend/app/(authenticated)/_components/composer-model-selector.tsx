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
  const { data: models, isPending } = useQuery({
    queryKey: ["models"],
    queryFn: async () => {
      const { data } = await agentReadModels({
        throwOnError: true,
      });

      return data;
    },
    retry: false,
    staleTime: Infinity,
  });

  if (isPending) {
    return (
      <Skeleton
        role="status"
        aria-label="正在加载模型"
        className="h-8 w-24 rounded-md"
      />
    );
  }

  if (!models?.data.length)
    return (
      <span className="text-muted-foreground text-xs">暂无可显示内容</span>
    );

  return (
    <ModelSelector
      models={models.data.map(({ id, supportsThinking }) => ({
        id,
        name: id,
        efforts: supportsThinking ? THINKING_OPTIONS : undefined,
      }))}
      defaultValue={models.defaultModel}
      defaultEffort="disabled"
      variant="ghost"
      size="sm"
    />
  );
}
