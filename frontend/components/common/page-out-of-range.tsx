import { AlertCircleIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

type PageOutOfRangeProps = {
  href: string;
  className?: string;
};

export function PageOutOfRange({ href, className }: PageOutOfRangeProps) {
  return (
    <Empty className={className}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <AlertCircleIcon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>当前页没有数据</EmptyTitle>
        <EmptyDescription>页码超出数据范围，请返回第一页。</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild variant="outline" size="sm">
          <Link href={href}>返回第一页</Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
