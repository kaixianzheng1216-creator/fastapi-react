export const MAX_AGENT_REQUEST_BYTES = 2 * 1024 * 1024;

export async function readLimitedRequestBody(
  request: Request,
  maxBytes = MAX_AGENT_REQUEST_BYTES,
): Promise<ArrayBuffer | null> {
  const contentLength = Number(request.headers.get("content-length"));

  if (contentLength > maxBytes) return null;
  if (!request.body) return new ArrayBuffer(0);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        return null;
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(new ArrayBuffer(totalBytes));
  let offset = 0;

  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return body.buffer;
}
