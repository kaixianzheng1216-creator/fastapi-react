import { proxyAgentRequest, readRunId } from "@/lib/agent-run-proxy";

export async function POST(request: Request): Promise<Response> {
  if (!request.headers.has("Authorization")) {
    return Response.json({ detail: "Not authenticated" }, { status: 401 });
  }

  const { isTooLarge, runId } = await readRunId(request);

  if (isTooLarge) {
    return Response.json(
      { detail: "Agent request body too large" },
      { status: 413 },
    );
  }

  if (!runId) {
    return Response.json({ detail: "runId is required" }, { status: 400 });
  }

  return proxyAgentRequest({
    request,
    path: `/runs/${encodeURIComponent(runId)}/stream`,
    method: "GET",
  });
}
