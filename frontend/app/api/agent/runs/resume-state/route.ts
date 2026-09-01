import { proxyAgentRequest } from "@/lib/agent-run-proxy";

export async function POST(request: Request): Promise<Response> {
  return proxyAgentRequest({
    request,
    path: "/runs/resume-state",
    method: "POST",
    forwardJsonBody: true,
  });
}
