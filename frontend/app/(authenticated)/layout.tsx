import type { ReactNode } from "react";

import { MyRuntimeProvider } from "@/app/MyRuntimeProvider";
import { AuthenticatedGuard } from "@/components/authenticated-guard";
import { ThreadListSidebar } from "@/components/threadlist-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default function AuthenticatedLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <AuthenticatedGuard>
      <MyRuntimeProvider>
        <SidebarProvider className="h-svh overflow-hidden">
          <ThreadListSidebar />
          <SidebarInset className="min-h-0">{children}</SidebarInset>
        </SidebarProvider>
      </MyRuntimeProvider>
    </AuthenticatedGuard>
  );
}
