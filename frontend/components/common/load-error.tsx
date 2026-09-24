import { AlertCircleIcon } from "lucide-react";

import { ButtonContent } from "@/components/common/button-content";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
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
  title = "暂时无法加载",
  onRetry,
  isRetrying = false,
  className,
}: LoadErrorProps) {
  return (
    <Empty role="alert" className={className}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <AlertCircleIcon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
      </EmptyHeader>
      <EmptyContent>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isRetrying}
          aria-busy={isRetrying}
          onClick={onRetry}
        >
          <ButtonContent loading={isRetrying}>重试</ButtonContent>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
