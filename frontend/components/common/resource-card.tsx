import { MoreHorizontalIcon, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CardGrid } from "@/components/common/collection-content";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

const SKELETON_COUNT = 2;
const dateFormatter = new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" });

type ResourceCardProps = {
  name: string;
  description: string | null;
  href: string;
  createdAt?: string;
  status?: ReactNode;
  icon: LucideIcon;
  actions: ReactNode;
};

export function ResourceCard({
  name,
  description,
  href,
  createdAt,
  status,
  icon: Icon,
  actions,
}: ResourceCardProps) {
  return (
    <Card className="relative h-full min-w-0 gap-0 py-0 shadow-none transition-shadow hover:shadow-md motion-reduce:transition-none">
      <Link
        href={href}
        aria-label={`进入 ${name}`}
        className="flex flex-1 flex-col gap-3 rounded-xl py-5 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <CardHeader className="flex min-w-0 items-start gap-3 px-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Icon aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <CardTitle className="pr-8">
              <h2 className="truncate leading-6" title={name}>
                {name}
              </h2>
            </CardTitle>
            <CardDescription
              className="mt-1 line-clamp-2 break-words"
              title={description ?? undefined}
            >
              {description || "暂无描述"}
            </CardDescription>
          </div>
        </CardHeader>
        {createdAt || status ? (
          <CardFooter className="mt-auto justify-between gap-3 px-5 pl-[4.5rem]">
            {createdAt ? (
              <span className="truncate text-xs text-muted-foreground">
                创建于{" "}
                <time dateTime={createdAt}>
                  {dateFormatter.format(new Date(createdAt))}
                </time>
              </span>
            ) : null}
            {status ? <span className="ml-auto shrink-0">{status}</span> : null}
          </CardFooter>
        ) : null}
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="absolute top-4 right-4"
            aria-label={`${name} 的更多操作`}
          >
            <MoreHorizontalIcon aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>{actions}</DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </Card>
  );
}

export function ResourceCardsSkeleton({
  showMetadata = false,
}: {
  showMetadata?: boolean;
}) {
  return (
    <div role="status" aria-label="正在加载列表…">
      <span className="sr-only">正在加载列表…</span>
      <CardGrid label="加载占位">
        {Array.from({ length: SKELETON_COUNT }, (_, index) => (
          <li key={index} aria-hidden="true">
            <Card className="relative h-full min-w-0 gap-0 py-0 shadow-none">
              <div className="flex flex-1 flex-col gap-3 py-5">
                <CardHeader className="flex min-w-0 items-start gap-3 px-5">
                  <Skeleton className="size-10 shrink-0 rounded-lg" />
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </CardHeader>
                {showMetadata ? (
                  <CardFooter className="mt-auto px-5 pl-[4.5rem]">
                    <Skeleton className="h-4 w-28" />
                  </CardFooter>
                ) : null}
              </div>
              <Skeleton className="absolute top-5 right-5 size-4 rounded-sm" />
            </Card>
          </li>
        ))}
      </CardGrid>
    </div>
  );
}
