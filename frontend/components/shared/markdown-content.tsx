import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

type MarkdownContentProps = {
  children: string;
  className?: string;
};

export function MarkdownContent({
  children,
  className,
}: MarkdownContentProps) {
  return (
    <div className={cn("prose dark:prose-invert", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
