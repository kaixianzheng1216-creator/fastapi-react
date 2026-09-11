import { UnderConstruction } from "@/components/common/under-construction";
import { AppHeader } from "@/components/layout/app-header";
import { SidebarTrigger } from "@/components/ui/sidebar";

export default function OverseasMarketingPage() {
  return (
    <>
      <AppHeader
        title="海外营销"
        left={<SidebarTrigger className="size-9" aria-label="切换管理菜单" />}
      />
      <UnderConstruction title="海外营销" />
    </>
  );
}
