import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

type MarkdownContentProps = {
  children: string;
  className?: string;
};

export function MarkdownContent({ children, className }: MarkdownContentProps) {
  return (
    <div
      className={cn(
        "prose dark:prose-invert scroll-content-x min-w-0 [&_table]:w-max [&_table]:min-w-full [&_td]:min-w-32 [&_td]:max-w-sm [&_td]:align-top [&_th]:whitespace-nowrap",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          img: ({ node: _node, alt, ...properties }) => (
            <img
              {...properties}
              alt={alt ?? ""}
              loading="lazy"
              decoding="async"
            />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
