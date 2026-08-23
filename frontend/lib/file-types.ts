export const TEXT_CONTENT_TYPES: readonly string[] = [
  "application/json",
  "text/csv",
  "text/markdown",
  "text/plain",
];

export const DOCUMENT_CONTENT_TYPES: readonly string[] = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/html",
];

export const KNOWLEDGE_CONTENT_TYPES: readonly string[] = [
  ...DOCUMENT_CONTENT_TYPES,
  ...TEXT_CONTENT_TYPES,
];

export const CHAT_CONTENT_TYPES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  ...KNOWLEDGE_CONTENT_TYPES,
];

export const MAX_FILE_SIZE = 100 * 1024 * 1024;
export const MAX_FILE_COUNT = 9;

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  csv: "text/csv",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  gif: "image/gif",
  html: "text/html",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  json: "application/json",
  md: "text/markdown",
  pdf: "application/pdf",
  png: "image/png",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  webp: "image/webp",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export function getFileContentType(file: File): string | undefined {
  if (file.type) return file.type;

  const extension = file.name.split(".").pop()?.toLowerCase();

  return extension ? CONTENT_TYPE_BY_EXTENSION[extension] : undefined;
}
