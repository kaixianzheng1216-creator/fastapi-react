import { agentChat, type AgentChatRequest } from "@/lib/client";

const backendUrl = process.env.BACKEND_API_URL;

if (!backendUrl) throw new Error("BACKEND_API_URL 未配置");

export async function POST(request: Request): Promise<Response> {
  const authorization = request.headers.get("Authorization");
  const body = (await request.json()) as AgentChatRequest;
  const result = await agentChat({
    baseUrl: backendUrl,
    body,
    headers: authorization ? { Authorization: authorization } : undefined,
    parseAs: "stream",
  });

  if (!result.response) throw result.error;

  if (result.error !== undefined) {
    return Response.json(result.error, { status: result.response.status });
  }

  return result.response;
}
