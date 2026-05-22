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

function contentSecurityPolicy(): string {
  const connect = new Set([
    "'self'",
    "http://127.0.0.1:8000",
    "http://localhost:8000",
    "https://api.stripe.com",
    "https://m.stripe.network",
    "https://r.stripe.com",
    "https://q.stripe.com",
    "https://js.stripe.com",
    "https://hooks.stripe.com",
  ]);
  const api = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (api && /^https?:\/\//i.test(api)) {
    try {
      connect.add(new URL(api).origin);
    } catch {
      /* ignore */
    }
  }
  if (process.env.NODE_ENV !== "production") {
    connect.add("ws:");
    connect.add("wss:");
  }
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    /* http: — imagens de evento em URLs http (comum em dev ou legado) */
    "img-src 'self' data: https: http: blob:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'unsafe-inline' https://js.stripe.com https://accounts.google.com https://appleid.cdn-apple.com",
    "connect-src "
      + [
        ...connect,
        "https://accounts.google.com",
        "https://appleid.apple.com",
        "https://appleid.cdn-apple.com",
      ].join(" "),
    "frame-src https://js.stripe.com https://hooks.stripe.com https://accounts.google.com https://appleid.apple.com",
  ].join("; ");
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
  async headers() {
    const security = [
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
    ];
    /* CSP estrita quebra o `next dev` (eval / HMR / chunks). Só enviar em produção (`next build` + `next start`). */
    if (process.env.NODE_ENV === "production") {
      security.push({ key: "Content-Security-Policy", value: contentSecurityPolicy() });
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
    return [{ source: "/api/:path*", destination: `${apiTarget}/api/:path*` }];
  },
};

export default nextConfig;
