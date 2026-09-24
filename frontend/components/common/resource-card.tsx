import { MoreHorizontalIcon, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode, SyntheticEvent } from "react";

import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CardGrid } from "@/components/common/collection-content";
import { ButtonContent } from "@/components/common/button-content";
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
  pending?: boolean;
  onTriggerInteraction?: (event: SyntheticEvent<HTMLButtonElement>) => void;
};

export function ResourceCard({
  name,
  description,
  href,
  createdAt,
  status,
  icon: Icon,
  actions,
  pending = false,
  onTriggerInteraction,
}: ResourceCardProps) {
  return (
    <Card className="relative h-full min-w-0 transition-shadow hover:shadow-md focus-within:shadow-md motion-reduce:transition-none">
      <CardHeader className="min-w-0">
        <CardTitle className="min-w-0">
          <h2 className="flex min-w-0 items-center gap-2">
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            <Link
              href={href}
              aria-label={`进入 ${name}`}
              title={name}
              className="truncate outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50"
            >
              {name}
            </Link>
          </h2>
        </CardTitle>
        <CardDescription
          className="line-clamp-2 break-words"
          title={description ?? undefined}
        >
          {description || "暂无描述"}
        </CardDescription>
        <CardAction className="relative z-10">
          <DropdownMenu>
            <DropdownMenuTrigger
              asChild
              onPointerDown={onTriggerInteraction}
              onFocus={onTriggerInteraction}
            >
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`${name} 的更多操作`}
                disabled={pending}
                aria-busy={pending}
              >
                <ButtonContent loading={pending} icon={MoreHorizontalIcon} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>{actions}</DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>
      {createdAt || status ? (
        <CardFooter className="mt-auto justify-between gap-3">
          {createdAt ? (
            <CardDescription className="truncate">
              创建于{" "}
              <time dateTime={createdAt}>
                {dateFormatter.format(new Date(createdAt))}
              </time>
            </CardDescription>
          ) : null}
          {status ? <span className="ml-auto shrink-0">{status}</span> : null}
        </CardFooter>
      ) : null}
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
      <CardGrid label="加载占位">
        {Array.from({ length: SKELETON_COUNT }, (_, index) => (
          <li key={index} aria-hidden="true">
            <Card className="h-full min-w-0">
              <CardHeader className="min-w-0">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <CardAction>
                  <Skeleton className="size-8" />
                </CardAction>
              </CardHeader>
              {showMetadata ? (
                <CardFooter className="mt-auto">
                  <Skeleton className="h-4 w-28" />
                </CardFooter>
              ) : null}
            </Card>
          </li>
        ))}
      </CardGrid>
    </div>
  );
}
