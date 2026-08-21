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

export const CHAT_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  ...KNOWLEDGE_CONTENT_TYPES,
];

export const MAX_FILE_SIZE = 100 * 1024 * 1024;
export const MAX_FILE_COUNT = 9;
