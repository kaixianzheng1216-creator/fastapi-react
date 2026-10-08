import { proxyAgentRequest, readRunId } from "@/lib/agent-run-proxy";

export async function POST(request: Request): Promise<Response> {
  const { isTooLarge, runId } = await readRunId(request);

  if (isTooLarge) {
    return Response.json(
      { detail: "智能助手请求内容过大" },
      { status: 413 },
    );
  }

  if (!runId) {
    return Response.json({ detail: "缺少运行 ID（runId）" }, { status: 400 });
  }

  return proxyAgentRequest({
    request,
    path: `/runs/${encodeURIComponent(runId)}/stream`,
    method: "GET",
  });
}
