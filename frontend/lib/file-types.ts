export const TEXT_CONTENT_TYPES: readonly string[] = [
  "text/csv",
  "text/markdown",
  "text/plain",
];

export const IMAGE_CONTENT_TYPES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

const DOCLING_CONTENT_TYPES: readonly string[] = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/html",
];

export const DOCUMENT_CONTENT_TYPES: readonly string[] = [
  ...DOCLING_CONTENT_TYPES,
  ...TEXT_CONTENT_TYPES,
];

const MEDIA_CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  mp4: "video/mp4",
  mov: "video/quicktime",
};

export const KNOWLEDGE_CONTENT_TYPES: readonly string[] = [
  ...IMAGE_CONTENT_TYPES,
  ...DOCUMENT_CONTENT_TYPES,
  ...Object.values(MEDIA_CONTENT_TYPE_BY_EXTENSION),
];

export const CHAT_CONTENT_TYPES: readonly string[] = [
  ...IMAGE_CONTENT_TYPES,
  ...DOCUMENT_CONTENT_TYPES,
];

export const MAX_FILE_SIZE = 100 * 1024 * 1024;
export const MAX_FILE_COUNT = 9;

const sizeFormatter = new Intl.NumberFormat("zh-CN", {
  maximumFractionDigits: 1,
});

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  ...MEDIA_CONTENT_TYPE_BY_EXTENSION,
  csv: "text/csv",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
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

export const KNOWLEDGE_FILE_ACCEPT = [
  ...KNOWLEDGE_CONTENT_TYPES,
  ...Object.entries(CONTENT_TYPE_BY_EXTENSION)
    .filter(([, type]) => KNOWLEDGE_CONTENT_TYPES.includes(type))
    .map(([extension]) => `.${extension}`),
].join(",");

export function getFileContentType(file: File): string | undefined {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension && MEDIA_CONTENT_TYPE_BY_EXTENSION[extension]) {
    return MEDIA_CONTENT_TYPE_BY_EXTENSION[extension];
  }

  if (file.type) return file.type;

  return extension ? CONTENT_TYPE_BY_EXTENSION[extension] : undefined;
}

export function formatFileSize(size: number): string {
  if (size < 1024 * 1024) {
    return `${sizeFormatter.format(size / 1024)} KB`;
  }

  return `${sizeFormatter.format(size / 1024 / 1024)} MB`;
}

export function deduplicateUploadFiles(incoming: File[]): File[] {
  const files: File[] = [];
  for (const file of incoming) {
    if (
      !files.some(
        (item) =>
          item.name === file.name &&
          item.size === file.size &&
          item.lastModified === file.lastModified,
      )
    ) {
      files.push(file);
    }
  }
  return files;
}
