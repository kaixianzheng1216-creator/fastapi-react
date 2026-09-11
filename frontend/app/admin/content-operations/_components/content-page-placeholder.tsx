import { AppHeader } from "@/components/layout/app-header";
import { UnderConstruction } from "@/components/common/under-construction";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function ContentPagePlaceholder({ title }: { title: string }) {
  return (
    <>
      <AppHeader
        title={title}
        left={<SidebarTrigger className="size-9" aria-label="切换管理菜单" />}
      />
      <UnderConstruction title={title} />
    </>
  );
}
