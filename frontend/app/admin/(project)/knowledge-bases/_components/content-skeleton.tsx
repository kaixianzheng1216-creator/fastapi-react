import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ContentSkeleton({
  variant = "cards",
}: {
  variant?: "cards" | "text";
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      className="flex flex-col gap-4 [&_[data-slot=skeleton]]:motion-reduce:animate-none"
    >
      <span className="sr-only">正在加载内容…</span>
      {variant === "cards" ? (
        Array.from({ length: 4 }, (_, index) => (
          <Card key={index} aria-hidden="true">
            <CardHeader>
              <Skeleton className="h-5 w-1/3" />
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>
        ))
      ) : (
        <div aria-hidden="true" className="flex flex-col gap-6">
          <div className="flex h-16 items-center justify-between gap-4 rounded-lg bg-muted/75 p-4">
            <div className="flex items-center gap-2">
              <Skeleton className="size-4" />
              <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="h-8 w-20" />
          </div>
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-8 w-1/3" />
          <div className="flex flex-col gap-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      )}
    </div>
  );
}
