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
        [0, 1].map((index) => (
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
        <div aria-hidden="true" className="flex flex-col gap-4">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      )}
    </div>
  );
}
