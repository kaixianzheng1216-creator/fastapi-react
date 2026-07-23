import { withAui } from "@assistant-ui/next";

const backendUrl = process.env.BACKEND_API_URL ?? "http://localhost:8000";
const agentProxyTimeoutMilliseconds = 11 * 60 * 1000;

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    optimizePackageImports: ["@assistant-ui/react"],
    proxyTimeout: agentProxyTimeoutMilliseconds,
  },
  async rewrites() {
    return [
      {
        source: "/api/login",
        destination: `${backendUrl}/api/v1/login/access-token`,
      },
      {
        source: "/api/signup",
        destination: `${backendUrl}/api/v1/users/signup`,
      },
      {
        source: "/api/chat",
        destination: `${backendUrl}/api/v1/agent/chat`,
      },
    ];
  },
};

export default withAui(nextConfig);
