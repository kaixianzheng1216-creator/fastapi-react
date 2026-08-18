"use client";

import { ThreadListSidebar } from "@/components/threadlist-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { configureApiClient, getAccessToken } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { MyRuntimeProvider } from "@/app/MyRuntimeProvider";

export default function AuthenticatedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const accessToken = getAccessToken();

    if (!accessToken) {
      router.replace("/login");
      return;
    }

    configureApiClient();

    setAuthenticated(true);
  }, [router]);

  if (!authenticated) {
    return null;
  }

  return (
    <MyRuntimeProvider>
      <SidebarProvider className="h-svh min-h-0 overflow-hidden">
        <ThreadListSidebar />
        <SidebarInset className="min-h-0">{children}</SidebarInset>
      </SidebarProvider>
    </MyRuntimeProvider>
  );
}
