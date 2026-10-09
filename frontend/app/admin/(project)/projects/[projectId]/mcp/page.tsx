"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { KeyManager } from "@/app/admin/(project)/mcp/_components/key-manager";
import { useProject } from "@/app/admin/_components/project-context";
import { AppHeader } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";
import { useActionFocus } from "@/hooks/use-action-focus";
import { usePaginationScrollReset } from "@/hooks/use-pagination-scroll-reset";
import { parsePage } from "@/lib/pagination";
import { AccessHelpDialog } from "./_components/access-help-dialog";

export default function McpPage() {
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const { rememberActionTrigger, restoreActionFocus } =
    useActionFocus(createButtonRef);

  const [origin, setOrigin] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const project = useProject();
  const params = useSearchParams();
  const scrollRef = usePaginationScrollReset<HTMLElement>(
    parsePage(params.get("page")),
  );
  const endpoint = `${origin}/mcp/project`;

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  if (!project) return null;

  return (
    <>
      <AppHeader title="MCP 接入" />

      <main
        ref={scrollRef}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 md:p-6"
      >
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6">
          <div
            role="group"
            aria-label="创建密钥与接入说明"
            className="flex flex-wrap items-center gap-2"
          >
            <Button
              ref={createButtonRef}
              onPointerDown={rememberActionTrigger}
              onFocus={rememberActionTrigger}
              onClick={() => setCreateOpen(true)}
            >
              创建密钥
            </Button>
            <AccessHelpDialog endpoint={endpoint} disabled={!origin} />
          </div>
          <KeyManager
            onTriggerInteraction={rememberActionTrigger}
            onCloseAutoFocus={restoreActionFocus}
            project={project}
            endpoint={endpoint}
            createOpen={createOpen}
            onCreateClose={() => setCreateOpen(false)}
          />
        </div>
      </main>
    </>
  );
}
