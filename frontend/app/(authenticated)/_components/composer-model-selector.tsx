"use client";

import { useQuery } from "@tanstack/react-query";
import { ModelSelector } from "@/app/(authenticated)/_components/model-selector";
import { agentReadModels } from "@/lib/client";

const THINKING_OPTIONS = [
  { id: "disabled", name: "关闭" },
  { id: "enabled", name: "开启" },
] as const;

export function ComposerModelSelector() {
  const { data: models } = useQuery({
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

  if (!models) return null;

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
