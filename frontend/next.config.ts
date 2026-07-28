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

// Domínio público de imagens (R2 pub-xxxx.r2.dev hoje; domínio próprio no futuro,
// bastando trocar NEXT_PUBLIC_R2_PUBLIC_URL — sem editar código).
const r2PublicHostname = (() => {
  const raw = process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).hostname;
  } catch {
    return null;
  }
})();

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
      ...(r2PublicHostname
        ? [{ protocol: "https" as const, hostname: r2PublicHostname }]
        : []),
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
      // Exclui /api/admin/session e /api/admin/proxy/* — são rotas do PRÓPRIO Next.js
      // (não existem no FastAPI). Sem essa exclusão, esse rewrite intercepta a
      // requisição ANTES do Next.js chegar a tentar casar com essas rotas de
      // app/api/admin/{session,proxy}/route.ts, e manda tudo direto pro backend —
      // que responde 404 pra um caminho que nunca existiu lá (bug: 'Not Found' em
      // toda chamada do painel admin, mesmo com sessão/chave válidas).
      {
        source: "/api/:path((?!admin/session|admin/proxy).*)",
        destination: `${apiTarget}/api/:path`,
      },
      { source: "/uploads/:path*", destination: `${apiTarget}/uploads/:path*` },
    ];
  },
};

export default nextConfig;
