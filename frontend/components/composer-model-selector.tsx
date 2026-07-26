"use client";

import { ModelSelector } from "@/components/model-selector";
import { getAccessToken } from "@/lib/auth";
import {
  agentReadModels,
  type AgentModelsPublic,
} from "@/lib/client";
import { useEffect, useState } from "react";

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
      models={models.data.map(({ id }) => ({ id, name: id }))}
      defaultValue={models.defaultModel}
      variant="ghost"
      size="sm"
    />
  );
}
