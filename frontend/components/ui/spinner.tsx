import { LoaderIcon } from "lucide-react";

import { cn } from "@/lib/utils";

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <LoaderIcon
      role="status"
      aria-label="正在加载"
      className={cn(
        "size-4 shrink-0 origin-center animate-spin [transform-box:view-box] motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
}

export { Spinner };
