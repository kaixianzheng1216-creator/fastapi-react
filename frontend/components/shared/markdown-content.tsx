import ReactMarkdown from "react-markdown";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

type MarkdownContentProps = {
  children: string;
  className?: string;
  headingPrefix?: string;
};

export function MarkdownContent({
  children,
  className,
  headingPrefix,
}: MarkdownContentProps) {
  return (
    <div className={cn("prose dark:prose-invert", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={
          headingPrefix ? [[rehypeSlug, { prefix: headingPrefix }]] : undefined
        }
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
