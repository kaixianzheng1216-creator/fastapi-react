import { client } from "@/lib/client/client.gen";

let apiClientConfigured = false;

export function handleUnauthorizedResponse(response: Response): boolean {
  if (response.status !== 401) return false;

  const path = new URL(response.url).pathname;

  // 登录和邀请接口由各自页面处理失效会话。
  if (
    path.startsWith("/api/v1/auth/") ||
    path.startsWith("/api/v1/invitations/")
  ) {
    return false;
  }

  window.location.replace("/login");

  return true;
}

export function configureApiClient(): void {
  if (apiClientConfigured) return;

  client.setConfig({ credentials: "same-origin" });

  client.interceptors.response.use((response) => {
    handleUnauthorizedResponse(response);
    return response;
  });

  apiClientConfigured = true;
}
