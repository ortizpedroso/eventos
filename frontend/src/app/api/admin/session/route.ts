import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { verificarCodigoTotp } from "@/lib/admin-totp";

const ADMIN_COOKIE = "eventosbr_admin_key";
const AUTH_COOKIE = "eventosbr_session";
const COOKIE_MAX_AGE = 60 * 60 * 4;

function internalApiOrigin(): string {
  const internal = process.env.INTERNAL_API_URL?.trim();
  if (internal) return internal.replace(/\/+$/, "").replace(/\/api$/, "");
  const pub = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (pub) return pub.replace(/\/+$/, "").replace(/\/api$/, "");
  return "http://127.0.0.1:8000";
}

/** Segredo TOTP compartilhado do painel admin (opt-in). Vazio = 2FA desligado (comportamento anterior). */
function adminTotpSecret(): string {
  return (process.env.ADMIN_TOTP_SECRET || "").trim();
}

function cookieSecure(): boolean {
  if (process.env.NODE_ENV !== "production") return false;
  const pub = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.FRONTEND_PUBLIC_URL ?? "").trim();
  return pub.startsWith("https://");
}

function cookieOpts() {
  return {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "strict" as const,
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  };
}

// Rate limit simples em memória (por IP) para o código TOTP — evita força bruta ao PIN de 6 dígitos.
const _tentativas = new Map<string, { count: number; resetAt: number }>();
const _LIMITE = 8;
const _JANELA_MS = 60_000;

function totpRateLimited(ip: string): boolean {
  const agora = Date.now();
  const atual = _tentativas.get(ip);
  if (!atual || atual.resetAt < agora) {
    _tentativas.set(ip, { count: 1, resetAt: agora + _JANELA_MS });
    return false;
  }
  atual.count += 1;
  return atual.count > _LIMITE;
}

export async function POST(req: NextRequest) {
  let key = "";
  let codigo = "";
  try {
    const body = (await req.json()) as { key?: string; codigo?: string };
    key = (body.key ?? "").trim();
    codigo = (body.codigo ?? "").trim();
  } catch {
    return NextResponse.json({ detail: "Corpo inválido." }, { status: 400 });
  }
  if (!key) {
    return NextResponse.json({ detail: "Informe a chave de administrador." }, { status: 400 });
  }

  const totpSecret = adminTotpSecret();
  if (totpSecret) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (totpRateLimited(ip)) {
      return NextResponse.json(
        { detail: "Muitas tentativas. Aguarde um minuto e tente novamente." },
        { status: 429 },
      );
    }
    if (!codigo) {
      return NextResponse.json({ detail: "Informe o código do app autenticador." }, { status: 400 });
    }
    if (!verificarCodigoTotp(totpSecret, codigo)) {
      return NextResponse.json({ detail: "Código de autenticação inválido." }, { status: 401 });
    }
  }

  const base = internalApiOrigin();
  const probe = await fetch(`${base}/api/admin/marketing/contatos?limit=1`, {
    headers: { accept: "application/json", "X-Platform-Admin-Key": key },
    cache: "no-store",
  });
  if (probe.status === 401) {
    return NextResponse.json({ detail: "Chave de administrador inválida." }, { status: 401 });
  }
  if (!probe.ok) {
    return NextResponse.json({ detail: `API respondeu ${probe.status}.` }, { status: 502 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, key, cookieOpts());
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(ADMIN_COOKIE);
  return res;
}

export async function GET() {
  const jar = await cookies();
  if (jar.get(ADMIN_COOKIE)?.value) {
    return NextResponse.json({ unlocked: true, totp_required: Boolean(adminTotpSecret()) });
  }

  // Login integrado (specs/admin-integrado-usuario.md): se a pessoa já está logada
  // normalmente numa conta com is_platform_admin+2FA, não precisa colar chave nenhuma.
  const sessionCookie = jar.get(AUTH_COOKIE)?.value?.trim();
  if (sessionCookie) {
    try {
      const base = internalApiOrigin();
      const probe = await fetch(`${base}/api/admin/marketing/contatos?limit=1`, {
        headers: { accept: "application/json", cookie: `${AUTH_COOKIE}=${sessionCookie}` },
        cache: "no-store",
      });
      if (probe.ok) {
        return NextResponse.json({ unlocked: true, totp_required: false });
      }
    } catch {
      // rede indisponível — cai para "não desbloqueado", mostra a tela de chave normalmente
    }
  }

  return NextResponse.json({ unlocked: false, totp_required: Boolean(adminTotpSecret()) });
}
