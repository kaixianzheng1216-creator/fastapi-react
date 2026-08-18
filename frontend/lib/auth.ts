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

export function configureApiClient(): void {
  if (apiClientConfigured) return;

  client.setConfig({ auth: () => getAccessToken() ?? undefined });

  client.interceptors.response.use((response) => {
    if (response.status === 401) {
      clearAccessToken();

      window.location.replace("/login");
    }

    return response;
  });

  apiClientConfigured = true;
}
