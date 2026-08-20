import type { ReactNode } from "react";

import { AdminShell } from "@/components/admin-shell";
import { AuthenticatedGuard } from "@/components/authenticated-guard";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AuthenticatedGuard>
      <AdminShell>{children}</AdminShell>
    </AuthenticatedGuard>
  );
}
