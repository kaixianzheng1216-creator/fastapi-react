import { ButtonContent } from "@/components/common/button-content";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
    <div
      role="alert"
      className={cn(
        "flex min-h-24 flex-1 flex-wrap items-center justify-center gap-x-3 gap-y-1 p-6 text-sm",
        className,
      )}
    >
      <span className="text-muted-foreground">{title}</span>
      <Button
        type="button"
        variant="link"
        size="sm"
        className="px-0"
        disabled={isRetrying}
        aria-busy={isRetrying}
        onClick={onRetry}
      >
        <ButtonContent loading={isRetrying}>重试</ButtonContent>
      </Button>
    </div>
  );
}
