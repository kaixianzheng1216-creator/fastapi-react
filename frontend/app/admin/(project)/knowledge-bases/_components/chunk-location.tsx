import { CardDescription } from "@/components/ui/card";

export function ChunkLocation({
  pageNumbers,
  sectionPath,
}: {
  pageNumbers: number[];
  sectionPath: string[];
}) {
  return (
    <CardDescription className="flex flex-wrap gap-x-4 gap-y-1">
      <span>
        页码：
        {pageNumbers.length > 0
          ? `第 ${pageNumbers.join("、")} 页`
          : "未标注"}
      </span>
      <span>
        章节：{sectionPath.length > 0 ? sectionPath.join(" / ") : "未标注"}
      </span>
    </CardDescription>
  );
}
