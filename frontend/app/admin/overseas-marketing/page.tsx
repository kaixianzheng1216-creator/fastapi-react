import { UnderConstruction } from "@/components/common/under-construction";
import { AppHeader } from "@/components/layout/app-header";
import { SidebarTrigger } from "@/components/ui/sidebar";

export default function OverseasMarketingPage() {
  return (
    <>
      <AppHeader title="海外营销" left={<SidebarTrigger />} />
      <UnderConstruction title="海外营销" />
    </>
  );
}
