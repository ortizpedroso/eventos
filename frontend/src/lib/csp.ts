/** CSP com nonce para scripts próprios (Stripe/Google mantidos na allowlist). */
export function buildContentSecurityPolicy(nonce: string, dev: boolean): string {
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
    "https://accounts.google.com",
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

  const scriptSrc = dev
    ? `'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://accounts.google.com`
    : `'self' 'nonce-${nonce}' 'strict-dynamic' https://js.stripe.com https://accounts.google.com`;

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "img-src 'self' https: data: blob:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "style-src 'self' 'unsafe-inline'",
    `script-src ${scriptSrc}`,
    `connect-src ${[...connect].join(" ")}`,
    "frame-src https://js.stripe.com https://hooks.stripe.com https://accounts.google.com",
  ].join("; ");
}
