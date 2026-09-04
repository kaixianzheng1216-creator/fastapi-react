import { MarkdownContent } from "@/components/shared/markdown-content";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { z } from "zod";

const textCardSchema = z.object({
  title: z.string().trim().min(1),
  content: z.string().trim().min(1),
});

export function ResearchTextCard({ value }: { value: string }) {
  let input: unknown;

  try {
    input = JSON.parse(value) as unknown;
  } catch {
    return <InvalidTextCard />;
  }

  const result = textCardSchema.safeParse(input);

  if (!result.success) {
    return <InvalidTextCard />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{result.data.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <MarkdownContent className="max-w-none text-sm">
          {result.data.content}
        </MarkdownContent>
      </CardContent>
    </Card>
  );
}

function InvalidTextCard() {
  return (
    <Alert data-report-block-error variant="destructive">
      <AlertDescription>文本卡片数据格式无效</AlertDescription>
    </Alert>
  );
}
