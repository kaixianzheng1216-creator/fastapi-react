"use client";

import {
  type Artifact,
  type ArtifactState,
} from "@/app/MyRuntimeProvider";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useAuiState } from "@assistant-ui/react";
import { ChevronDownIcon, FileIcon } from "lucide-react";

export function ArtifactList() {
  const artifactState = useAuiState(
    (state) => state.thread.state,
  ) as ArtifactState | null;
  const artifacts = artifactState?.artifacts ?? [];

  return (
    <Collapsible defaultOpen>
      <CardHeader>
        <CollapsibleTrigger className="group flex w-full items-center justify-between">
          <CardTitle className="font-normal">产物</CardTitle>
          <ChevronDownIcon className="size-4 -rotate-90 transition-transform group-data-[state=open]:rotate-0" />
        </CollapsibleTrigger>
      </CardHeader>
      <CollapsibleContent>
        <CardContent className="max-h-64 overflow-y-auto">
          {artifacts.length === 0 ? (
            <CardDescription className="text-sm">暂无产物</CardDescription>
          ) : (
            <ul className="space-y-3 text-sm">
              {artifacts.map((artifact, index) => (
                <ArtifactItem key={`${artifact.url}-${index}`} artifact={artifact} />
              ))}
            </ul>
          )}
        </CardContent>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ArtifactItem({ artifact }: { artifact: Artifact }) {
  return (
    <li>
      <a
        className="flex items-center gap-2 hover:underline"
        href={artifact.url}
        rel="noreferrer"
        target="_blank"
      >
        <FileIcon className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{artifact.name}</span>
      </a>
    </li>
  );
}
