"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ChevronDownIcon, ChevronsRightIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type ResearchHeading = {
  id: string;
  level: 2 | 3;
  title: string;
};

function useActiveHeading(headings: ResearchHeading[]) {
  const [activeId, setActiveId] = useState("");

  useEffect(() => {
    const elements = headings.flatMap((heading) => {
      const element = document.getElementById(heading.id);
      return element ? [element] : [];
    });

    if (!elements.length) return;
    const scrollContainer = elements[0].closest<HTMLElement>(
      ".aui-thread-viewport",
    );

    const updateActiveHeading = () => {
      if (
        scrollContainer &&
        scrollContainer.scrollTop + scrollContainer.clientHeight >=
          scrollContainer.scrollHeight - 1
      ) {
        setActiveId(elements.at(-1)?.id ?? "");
        return;
      }

      const threshold =
        (scrollContainer?.getBoundingClientRect().top ?? 0) + 120;
      const current =
        elements.findLast(
          (element) => element.getBoundingClientRect().top <= threshold,
        ) ?? elements[0];
      setActiveId(current.id);
    };

    updateActiveHeading();

    scrollContainer?.addEventListener("scroll", updateActiveHeading, {
      passive: true,
    });

    return () => {
      scrollContainer?.removeEventListener("scroll", updateActiveHeading);
    };
  }, [headings]);

  return activeId;
}

function HeadingLinks({
  activeId,
  headings,
}: {
  activeId: string;
  headings: ResearchHeading[];
}) {
  return (
    <ol className="flex flex-col gap-1">
      {headings.map((heading) => (
        <li key={heading.id}>
          <Button
            asChild
            variant={activeId === heading.id ? "secondary" : "ghost"}
            size="sm"
            className={cn(
              "h-auto min-h-8 w-full justify-start py-2 whitespace-normal",
              heading.level === 3 && "pl-6",
            )}
          >
            <a
              href={`#${heading.id}`}
              aria-current={activeId === heading.id ? "location" : undefined}
              title={heading.title}
            >
              <span className="min-w-0 flex-1 break-words text-left leading-5">
                {heading.title}
              </span>
            </a>
          </Button>
        </li>
      ))}
    </ol>
  );
}

export function ResearchTableOfContents({
  desktopOpen,
  headings,
  onDesktopOpenChange,
}: {
  desktopOpen: boolean;
  headings: ResearchHeading[];
  onDesktopOpenChange: (open: boolean) => void;
}) {
  const activeId = useActiveHeading(headings);
  const desktopScrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = desktopScrollAreaRef.current?.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]',
    );
    const activeLink = viewport?.querySelector<HTMLElement>(
      '[aria-current="location"]',
    );
    if (!viewport || !activeLink) return;

    const viewportRect = viewport.getBoundingClientRect();
    const activeRect = activeLink.getBoundingClientRect();

    if (activeRect.top < viewportRect.top) {
      viewport.scrollTop -= viewportRect.top - activeRect.top;
    } else if (activeRect.bottom > viewportRect.bottom) {
      viewport.scrollTop += activeRect.bottom - viewportRect.bottom;
    }
  }, [activeId]);

  return (
    <>
      {desktopOpen ? (
        <aside className="hidden self-stretch xl:block">
          <Card className="sticky top-4 gap-3 py-3 shadow-none">
            <CardHeader className="px-3">
              <CardTitle className="text-sm">目录</CardTitle>
              <CardAction>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => onDesktopOpenChange(false)}
                >
                  <ChevronsRightIcon data-icon="inline-start" />
                  收起
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="px-2">
              <ScrollArea
                ref={desktopScrollAreaRef}
                className="h-[calc(100svh-14rem)]"
                viewportClassName="me-5 w-auto"
              >
                <nav aria-label="报告目录">
                  <HeadingLinks headings={headings} activeId={activeId} />
                </nav>
              </ScrollArea>
            </CardContent>
          </Card>
        </aside>
      ) : null}

      <Collapsible className="group/toc xl:hidden">
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <span>目录</span>
            <ChevronDownIcon className="transition-transform group-data-[state=open]/toc:rotate-180" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <nav aria-label="报告目录">
            <HeadingLinks headings={headings} activeId={activeId} />
          </nav>
        </CollapsibleContent>
      </Collapsible>
    </>
  );
}
