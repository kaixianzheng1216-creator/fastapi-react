import { SidebarMenuButton } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export function SidebarItemButton({
  className,
  isActive,
  ...props
}: React.ComponentProps<typeof SidebarMenuButton>) {
  return (
    <SidebarMenuButton
      {...props}
      isActive={isActive}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "data-[active=true]:bg-background data-[active=true]:font-semibold data-[active=true]:shadow-sm data-[active=true]:hover:bg-background",
        className,
      )}
    />
  );
}
