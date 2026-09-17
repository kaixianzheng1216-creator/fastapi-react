import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { TableBody, TableCell, TableRow } from "@/components/ui/table";

const SKELETON_ROW_COUNT = 6;
const CELL_WIDTHS = ["72%", "88%", "56%", "80%", "64%"];

type TableSkeletonBodyProps = {
  columns: number;
  getCellClassName?: (columnIndex: number) => string | undefined;
};

export function TableSkeletonBody({
  columns,
  getCellClassName,
}: TableSkeletonBodyProps): ReactNode {
  return (
    <TableBody aria-hidden="true">
      {Array.from({ length: SKELETON_ROW_COUNT }, (_, row) => (
        <TableRow key={row} className="hover:bg-transparent">
          {Array.from({ length: columns }, (_, column) => (
            <TableCell key={column} className={getCellClassName?.(column)}>
              <Skeleton
                className="inline-block h-4 align-middle motion-reduce:animate-none"
                style={{
                  width: CELL_WIDTHS[(row + column) % CELL_WIDTHS.length],
                }}
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  );
}
