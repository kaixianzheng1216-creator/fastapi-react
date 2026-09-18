import { getApiErrorMessage } from "@/lib/api-error";
import { formatFileSize, MAX_FILE_SIZE } from "@/lib/file-types";

const UPLOAD_CONCURRENCY = 3;

export type UploadResult = { file: File; error?: string };

export async function transferDocumentUpload(
  file: File,
  upload: { uploadUrl: string; uploadHeaders: Record<string, string> },
  actions: {
    complete: () => Promise<{ error?: unknown }>;
    discard: () => Promise<unknown>;
  },
): Promise<UploadResult> {
  try {
    const response = await fetch(upload.uploadUrl, {
      method: "PUT",
      headers: upload.uploadHeaders,
      body: file,
    });
    if (!response.ok) {
      throw new Error(`对象存储上传失败（${response.status}）`);
    }
  } catch (error) {
    await actions.discard();
    return {
      file,
      error: `上传失败：${getApiErrorMessage(error, "文件传输失败")}`,
    };
  }

  const { error } = await actions.complete();
  return error
    ? { file, error: getApiErrorMessage(error, "确认上传失败") }
    : { file };
}

export async function uploadFiles(
  files: File[],
  upload: (file: File) => Promise<UploadResult>,
): Promise<UploadResult[]> {
  const outcomes: UploadResult[] = [];
  for (let start = 0; start < files.length; start += UPLOAD_CONCURRENCY) {
    const batch = files.slice(start, start + UPLOAD_CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (file): Promise<UploadResult> => {
        if (file.size === 0 || file.size > MAX_FILE_SIZE) {
          return {
            file,
            error: `文件大小须大于 0 且不超过 ${formatFileSize(MAX_FILE_SIZE)}`,
          };
        }
        try {
          return await upload(file);
        } catch (error) {
          return { file, error: getApiErrorMessage(error, "文件上传失败") };
        }
      }),
    );
    outcomes.push(...results);
  }
  return outcomes;
}
