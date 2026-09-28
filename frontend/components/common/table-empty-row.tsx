import type { ReactNode } from "react";

import { TableCell, TableRow } from "@/components/ui/table";
export function TableEmptyRow({
  colSpan,
  children,
}: {
  colSpan: number;
  children: ReactNode;
}) {
  return (
    <TableRow>
      <TableCell
        colSpan={colSpan}
        className="h-24 text-center text-muted-foreground whitespace-normal"
      >
        <span role="status">{children}</span>
      </TableCell>
    </TableRow>
  );
}
