import { CircleAlertIcon } from "lucide-react";

import { ButtonLoading } from "@/components/shared/button-loading";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

type LoadErrorProps = {
  title?: string;
  onRetry: () => void;
  isRetrying?: boolean;
  className?: string;
};

export function LoadError({
  title = "加载失败",
  onRetry,
  isRetrying = false,
  className,
}: LoadErrorProps) {
  return (
    <Empty role="alert" className={className}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CircleAlertIcon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>暂时无法获取数据，请重试。</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="relative"
          disabled={isRetrying}
          aria-busy={isRetrying}
          onClick={onRetry}
        >
          <ButtonLoading loading={isRetrying}>
            重试
          </ButtonLoading>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
