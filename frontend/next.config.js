import { withAui } from "@assistant-ui/next";

const backendUrl = process.env.BACKEND_API_URL;

if (!backendUrl) throw new Error("BACKEND_API_URL 未配置");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  allowedDevOrigins: ["frontend"],
  async redirects() {
    return [
      { source: "/", destination: "/admin", permanent: false },
      { source: "/skills/:path*", destination: "/admin", permanent: false },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backendUrl}/api/v1/:path*`,
      },
      {
        source: "/mcp/:path*",
        destination: `${backendUrl}/mcp/:path*/`,
      },
    ];
  },
};

export default withAui(nextConfig);
