import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const ADMIN_COOKIE = "eventosbr_admin_key";
const COOKIE_MAX_AGE = 60 * 60 * 4;

function internalApiOrigin(): string {
  const internal = process.env.INTERNAL_API_URL?.trim();
  if (internal) return internal.replace(/\/+$/, "").replace(/\/api$/, "");
  const pub = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (pub) return pub.replace(/\/+$/, "").replace(/\/api$/, "");
  return "http://127.0.0.1:8000";
}

function cookieOpts() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  };
}

export async function POST(req: NextRequest) {
  let key = "";
  try {
    const body = (await req.json()) as { key?: string };
    key = (body.key ?? "").trim();
  } catch {
    return NextResponse.json({ detail: "Corpo inválido." }, { status: 400 });
  }
  if (!key) {
    return NextResponse.json({ detail: "Informe a chave de administrador." }, { status: 400 });
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
  return NextResponse.json({ unlocked: Boolean(jar.get(ADMIN_COOKIE)?.value) });
}
