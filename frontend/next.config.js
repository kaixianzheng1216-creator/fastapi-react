import { withAui } from "@assistant-ui/next";

const backendUrl = process.env.BACKEND_API_URL;

if (!backendUrl) throw new Error("BACKEND_API_URL 未配置");

const agentProxyTimeoutMilliseconds = 11 * 60 * 1000;

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  allowedDevOrigins: ["broodier-gleanable-alix.ngrok-free.dev"],
  experimental: {
    optimizePackageImports: ["@assistant-ui/react"],
    proxyTimeout: agentProxyTimeoutMilliseconds,
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backendUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default withAui(nextConfig);
