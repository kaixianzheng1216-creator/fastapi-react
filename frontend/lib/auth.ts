import { client } from "@/lib/client/client.gen";

const ACCESS_TOKEN_KEY = "access_token";
let apiClientConfigured = false;

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function saveAccessToken(accessToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
}

export function clearAccessToken(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
}

export function handleUnauthorizedResponse(response: Response): boolean {
  if (response.status !== 401) return false;
  if (new URL(response.url).pathname.endsWith("/login/access-token"))
    return false;

  clearAccessToken();

  window.location.replace("/login");

  return true;
}

export function configureApiClient(): void {
  if (apiClientConfigured) return;

  client.setConfig({ auth: () => getAccessToken() ?? undefined });

  client.interceptors.response.use((response) => {
    handleUnauthorizedResponse(response);
    return response;
  });

  apiClientConfigured = true;
}
