import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type TableSkeletonProps = {
  columns: number;
  rows?: number;
};

const CELL_WIDTHS = ["72%", "88%", "56%", "80%", "64%"];

export function TableSkeleton({ columns, rows = 6 }: TableSkeletonProps) {
  return (
    <div role="status" aria-label="正在加载数据">
      <Table aria-hidden="true">
        <TableHeader>
          <TableRow>
            {Array.from({ length: columns }, (_, column) => (
              <TableHead key={column}>
                <Skeleton
                  className="h-4"
                  style={{ width: CELL_WIDTHS[column % CELL_WIDTHS.length] }}
                />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }, (_, row) => (
            <TableRow key={row}>
              {Array.from({ length: columns }, (_, column) => (
                <TableCell key={column}>
                  <Skeleton
                    className="h-4"
                    style={{
                      width:
                        CELL_WIDTHS[(row + column + 1) % CELL_WIDTHS.length],
                    }}
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
