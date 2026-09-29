import {
  FileCodeIcon,
  FileIcon,
  FileImageIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  FileTypeIcon as FileLetterIcon,
  PresentationIcon,
  type LucideIcon,
} from "lucide-react";

const icons: Record<string, LucideIcon> = {
  "application/pdf": FileTextIcon,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    FileLetterIcon,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    FileSpreadsheetIcon,
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    PresentationIcon,
  "text/csv": FileSpreadsheetIcon,
  "text/markdown": FileCodeIcon,
  "text/html": FileCodeIcon,
  "text/plain": FileTextIcon,
};

export function FileTypeIcon({ contentType }: { contentType: string }) {
  let Icon = icons[contentType] ?? FileIcon;

  if (contentType.startsWith("image/")) Icon = FileImageIcon;

  return (
    <Icon
      aria-hidden="true"
      className="size-4 shrink-0 text-muted-foreground"
    />
  );
}
