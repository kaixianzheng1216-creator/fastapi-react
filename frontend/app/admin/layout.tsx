import type { ReactNode } from "react";

import { AdminShell } from "@/app/admin/_components/admin-shell";
import { AuthenticatedGuard } from "@/app/_components/authenticated-guard";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AuthenticatedGuard>
      <AdminShell>{children}</AdminShell>
    </AuthenticatedGuard>
  );
}
