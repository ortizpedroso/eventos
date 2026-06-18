/**
 * Prepara evento publicado via API (requer ASAAS_DISABLED ou credenciais Asaas no backend).
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

export async function seedPublishedEventAsaas(): Promise<SeededEvent> {
  const suf = `${Date.now()}`;
  const senha = "senha12345";
  const orgEmail = `e2e_asaas_org_${suf}@test.com`;

  await api("POST", "/api/auth/registrar", {
    email: orgEmail,
    nome: "Org Asaas E2E",
    senha,
    tipo: "organizador",
  });

  const { access_token: orgToken } = await api<{ access_token: string }>("POST", "/api/auth/login", {
    email: orgEmail,
    senha,
  });

  await api(
    "PUT",
    "/api/organizador/asaas/wallet",
    { wallet_id: "e2e-org-wallet", sincronizar_eventos: true },
    orgToken,
  );

  const ev = await api<{ id: string; slug: string; preco_compra?: number; preco_ingresso: number }>(
    "POST",
    "/api/eventos/criar",
    {
      nome: `E2E Asaas ${suf}`,
      descricao: "Evento para teste Playwright Asaas",
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

/** Evento publicado com vendas futuras (lista de interesse pré-venda). */
export async function seedPreVendaEvent(): Promise<SeededEvent> {
  const suf = `${Date.now()}`;
  const senha = "senha12345";
  const orgEmail = `e2e_prevenda_org_${suf}@test.com`;
  const vendasInicio = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 19);

  await api("POST", "/api/auth/registrar", {
    email: orgEmail,
    nome: "Org Pré-venda E2E",
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
      nome: `E2E Pré-venda ${suf}`,
      descricao: "Evento para teste lista de interesse",
      data_inicio: "2026-12-20T19:00:00",
      data_fim: "2026-12-20T23:00:00",
      local: "São Paulo",
      preco_ingresso: 30,
      categoria: "Outros",
      publicado: true,
      aceita_interesse: true,
      ingresso_lotes: [
        {
          nome: "Geral",
          preco: 30,
          ordem: 1,
          ativo: true,
          vendas_inicio: vendasInicio,
        },
      ],
    },
    orgToken,
  );

  return {
    slug: ev.slug,
    eventoId: ev.id,
    precoReais: Number(ev.preco_compra ?? ev.preco_ingresso ?? 30),
  };
}

export async function apiLogin(email: string, senha: string): Promise<string> {
  const { access_token } = await api<{ access_token: string }>("POST", "/api/auth/login", {
    email,
    senha,
  });
  return access_token;
}

export async function simularWebhookAsaasPago(paymentId: string, ingressoId: string): Promise<void> {
  const token = process.env.ASAAS_WEBHOOK_TOKEN ?? "e2e-webhook-token";
  const res = await fetch(`${API}/api/webhooks/asaas`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "asaas-access-token": token,
    },
    body: JSON.stringify({
      event: "PAYMENT_RECEIVED",
      id: `evt_e2e_${Date.now()}`,
      payment: {
        id: paymentId,
        status: "RECEIVED",
        externalReference: ingressoId,
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Webhook Asaas E2E falhou: ${res.status} ${text}`);
  }
}
