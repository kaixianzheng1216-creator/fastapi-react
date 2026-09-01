import { RESUMABLE_STREAM_ID_HEADER } from "assistant-stream/resumable";

import { readLimitedRequestBody } from "@/lib/read-limited-request-body";

const backendUrl = process.env.BACKEND_API_URL;

if (!backendUrl) throw new Error("BACKEND_API_URL 未配置");

const forwardedResponseHeaders = [
  "content-type",
  "cache-control",
  "x-accel-buffering",
  RESUMABLE_STREAM_ID_HEADER,
] as const;

export async function proxyAgentRequest(options: {
  request: Request;
  path: string;
  method: "GET" | "POST";
  forwardJsonBody?: boolean;
}): Promise<Response> {
  const authorization = options.request.headers.get("Authorization");
  if (!authorization) {
    return Response.json({ detail: "Not authenticated" }, { status: 401 });
  }

  const headers = new Headers({ Authorization: authorization });
  let body: BodyInit | undefined;

  if (options.forwardJsonBody) {
    const requestBody = await readLimitedRequestBody(options.request);

    if (requestBody === null) {
      return Response.json(
        { detail: "Agent request body too large" },
        { status: 413 },
      );
    }

    headers.set("Content-Type", "application/json");
    body = requestBody;
  }

  const upstream = await fetch(
    `${backendUrl}/api/v1/agent${options.path}`,
    {
      method: options.method,
      headers,
      body,
      signal: options.request.signal,
      cache: "no-store",
    },
  );

  const responseHeaders = new Headers();

  for (const name of forwardedResponseHeaders) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export async function readRunId(request: Request): Promise<{
  isTooLarge: boolean;
  runId: string | null;
}> {
  const requestBody = await readLimitedRequestBody(request);

  if (requestBody === null) {
    return { isTooLarge: true, runId: null };
  }

  let body: unknown;

  try {
    body = JSON.parse(new TextDecoder().decode(requestBody));
  } catch {
    return { isTooLarge: false, runId: null };
  }

  if (!body || typeof body !== "object" || !("runId" in body)) {
    return { isTooLarge: false, runId: null };
  }

  return {
    isTooLarge: false,
    runId: typeof body.runId === "string" ? body.runId : null,
  };
}
