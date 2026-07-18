/** CSP com nonce para scripts próprios (Google OAuth na allowlist). */
export function buildContentSecurityPolicy(nonce: string, dev: boolean): string {
  const connect = new Set([
    "'self'",
    "http://127.0.0.1:8000",
    "http://localhost:8000",
    "https://accounts.google.com",
    "https://oauth2.googleapis.com",
    "https://www.googleapis.com",
    "https://api.asaas.com",
  ]);
  const api = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (api && /^https?:\/\//i.test(api)) {
    try {
      connect.add(new URL(api).origin);
    } catch {
      /* ignore */
    }
  }
  if (dev) {
    connect.add("ws:");
    connect.add("wss:");
  }

  const scriptHosts = [
    "https://accounts.google.com",
    "https://apis.google.com",
  ];

  const scriptSrc = dev
    ? `'self' 'unsafe-inline' 'unsafe-eval' ${scriptHosts.join(" ")}`
    : `'self' 'nonce-${nonce}' 'strict-dynamic' ${scriptHosts.join(" ")}`;

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "img-src 'self' https: data: blob:",
    "font-src 'self' data: https://fonts.gstatic.com https://www.gstatic.com",
    "style-src 'self' 'unsafe-inline' https://accounts.google.com https://fonts.googleapis.com",
    `script-src ${scriptSrc}`,
    `connect-src ${[...connect].join(" ")}`,
    "frame-src https://accounts.google.com",
  ].join("; ");
}
