/**
 * Prepara evento publicado via API (requer STRIPE_DISABLED ou Stripe test no backend).
 */

const API = (process.env.PLAYWRIGHT_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

async function api<T>(
  method: string,
  path: string,
  body?: Record<string, unknown>,
  token?: string,
): Promise<T> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  if (body) headers["content-type"] = "application/json";
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
}

export type SeededEvent = {
  slug: string;
  eventoId: string;
  precoReais: number;
};

export async function waitForApiReady(maxMs = 120_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(`${API}/ready`);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`API não respondeu em ${API}/ready após ${maxMs}ms`);
}

export async function seedPublishedEvent(): Promise<SeededEvent> {
  const suf = `${Date.now()}`;
  const senha = "senha12345";
  const orgEmail = `e2e_org_${suf}@test.com`;

  await api("POST", "/api/auth/registrar", {
    email: orgEmail,
    nome: "Org E2E",
    senha,
    tipo: "organizador",
  });

  const { access_token: orgToken } = await api<{ access_token: string }>("POST", "/api/auth/login", {
    email: orgEmail,
    senha,
  });

  const ev = await api<{ id: string; slug: string; preco_compra?: number; preco_ingresso: number }>(
    "POST",
    "/api/eventos/criar",
    {
      nome: `E2E Checkout ${suf}`,
      descricao: "Evento para teste Playwright",
      data_inicio: "2026-12-20T19:00:00",
      data_fim: "2026-12-20T23:00:00",
      local: "São Paulo",
      preco_ingresso: 30,
      categoria: "Outros",
      publicado: true,
      ingresso_lotes: [{ nome: "Geral", preco: 30, ordem: 1, ativo: true }],
    },
    orgToken,
  );

  return {
    slug: ev.slug,
    eventoId: ev.id,
    precoReais: Number(ev.preco_compra ?? ev.preco_ingresso ?? 30),
  };
}
