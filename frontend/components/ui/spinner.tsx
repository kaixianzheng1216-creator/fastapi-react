import { Loader2Icon } from "lucide-react"

import { cn } from "@/lib/utils"

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <Loader2Icon
      role="status"
      aria-label="正在加载"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  )
}

export { Spinner }
