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
  const cookie = options.request.headers
    .get("Cookie")
    ?.split(";")
    .find((value) => value.trim().startsWith("data_hub_session="))
    ?.trim();

  if (!cookie) {
    return Response.json({ detail: "尚未登录，请先登录" }, { status: 401 });
  }

  const origin = options.request.headers.get("Origin");

  const appOrigin = process.env.APP_ORIGIN;

  if (!appOrigin) throw new Error("APP_ORIGIN 未配置");

  if (options.request.method !== "GET" && origin !== new URL(appOrigin).origin) {
    return Response.json({ detail: "请求来源不受信任" }, { status: 403 });
  }

  const headers = new Headers({ Cookie: cookie });

  if (origin) headers.set("Origin", origin);

  let body: BodyInit | undefined;

  if (options.forwardJsonBody) {
    const requestBody = await readLimitedRequestBody(options.request);

    if (requestBody === null) {
      return Response.json(
        { detail: "智能助手请求内容过大" },
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

  for (const cookie of upstream.headers.getSetCookie()) {
    responseHeaders.append("Set-Cookie", cookie);
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
