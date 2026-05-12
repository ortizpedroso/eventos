import type { NextConfig } from "next";

const rawTarget =
  process.env.API_PROXY_TARGET?.trim() ??
  process.env.INTERNAL_API_URL?.trim() ??
  "http://127.0.0.1:8000";
let apiTarget = rawTarget.replace(/\/+$/, "");
if (apiTarget.endsWith("/api")) {
  apiTarget = apiTarget.slice(0, -4).replace(/\/+$/, "");
}

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiTarget}/api/:path*` }];
  },
};

export default nextConfig;
