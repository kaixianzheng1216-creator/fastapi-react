"use client";

import { ModelSelector } from "@/components/model-selector";
import { getAccessToken } from "@/lib/auth";
import { agentReadModels, type AgentModelsPublic } from "@/lib/client";
import { useEffect, useState } from "react";

const THINKING_OPTIONS = [
  { id: "disabled", name: "关闭" },
  { id: "enabled", name: "开启" },
] as const;

export function ComposerModelSelector() {
  const [models, setModels] = useState<AgentModelsPublic>();

  useEffect(() => {
    void agentReadModels({
      auth: getAccessToken() ?? undefined,
      throwOnError: true,
    }).then(({ data }) => setModels(data));
  }, []);

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
