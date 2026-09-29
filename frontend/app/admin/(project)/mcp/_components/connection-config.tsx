"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { toast } from "sonner";

import { ButtonContent } from "@/components/common/button-content";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { Button } from "@/components/ui/button";

type ConnectionConfigProps = {
  endpoint: string;
  apiKey: string;
  isTemplate?: boolean;
};

export function ConnectionConfig({
  endpoint,
  apiKey,
  isTemplate = false,
}: ConnectionConfigProps) {
  const config = JSON.stringify(
    {
      mcpServers: {
        "data-hub": {
          url: endpoint,
          headers: { Authorization: `Bearer ${apiKey}` },
        },
      },
    },
    null,
    2,
  );

  const { isCopied, isCopying, copyToClipboard } = useCopyToClipboard({
    onSuccess: () =>
      toast.success(
        isTemplate ? "配置模板已复制，请替换访问密钥" : "连接配置已复制",
      ),
    errorMessage: "无法自动复制，请选中下方配置手动复制",
  });

  return (
    <section className="flex min-w-0 flex-col gap-4" aria-label="连接配置">
      <div className="flex min-h-8 items-center justify-between gap-3">
        <h2 className="text-base font-semibold">连接配置</h2>
        <Button
          type="button"
          size="sm"
          onClick={() => copyToClipboard(config)}
          disabled={isCopying}
          aria-busy={isCopying}
        >
          <ButtonContent loading={isCopying} icon={isCopied ? CheckIcon : CopyIcon}>
            {isTemplate ? "复制配置模板" : "复制配置"}
          </ButtonContent>
        </Button>
      </div>

      <pre
        className="overflow-x-auto rounded-lg border bg-muted p-4 text-sm leading-6 select-text"
        tabIndex={0}
        aria-label="MCP 连接配置"
      >
        <code>{config}</code>
      </pre>

      {isTemplate && (
        <p className="text-sm text-muted-foreground">
          将配置中的访问密钥占位符替换为你已保存的完整密钥，再粘贴到 MCP
          客户端。
        </p>
      )}
    </section>
  );
}
