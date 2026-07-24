import path from "path";
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
  /**
   * Monorepo local: raiz do repo (lockfile acima de `frontend/`).
   * Imagem Docker (só `frontend/` em /app): usar __dirname para standalone plano com server.js na raiz.
   */
  outputFileTracingRoot:
    process.env.NEXT_DOCKER_STANDALONE === "1"
      ? __dirname
      : path.join(__dirname, ".."),
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  async headers() {
    const security = [
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "no-referrer" },
      {
        key: "Permissions-Policy",
        value: "camera=(self), microphone=(), geolocation=()",
      },
    ];
    if (process.env.NODE_ENV === "production") {
      security.push({
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains",
      });
    }
    return [{ source: "/:path*", headers: security }];
  },
  async redirects() {
    return [
      {
        source: "/evento/:slug",
        destination: "/eventos/:slug",
        permanent: true,
      },
      {
        source: "/evento/:slug/editar",
        destination: "/eventos/:slug/editar",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${apiTarget}/api/:path*` },
      { source: "/uploads/:path*", destination: `${apiTarget}/uploads/:path*` },
    ];
  },
};

export default nextConfig;
