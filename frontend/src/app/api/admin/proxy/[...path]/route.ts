import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const ADMIN_COOKIE = "eventosbr_admin_key";

function internalApiOrigin(): string {
  const internal = process.env.INTERNAL_API_URL?.trim();
  if (internal) return internal.replace(/\/+$/, "").replace(/\/api$/, "");
  const pub = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (pub) return pub.replace(/\/+$/, "").replace(/\/api$/, "");
  return "http://127.0.0.1:8000";
}

/** Só usa a chave da sessão admin (cookie). Nunca a variável de ambiente — evita bypass sem autenticação. */
async function adminKey(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(ADMIN_COOKIE)?.value?.trim() ?? null;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, ctx, "GET");
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, ctx, "POST");
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, ctx, "PATCH");
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, ctx, "DELETE");
}

async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }, method: string) {
  const key = await adminKey();
  if (!key) {
    return NextResponse.json({ detail: "Sessão admin não iniciada." }, { status: 401 });
  }

  const { path } = await ctx.params;
  const suffix = path.join("/");
  const base = internalApiOrigin();
  const url = new URL(`${base}/api/admin/${suffix}`);
  req.nextUrl.searchParams.forEach((v, k) => url.searchParams.set(k, v));

  const headers = new Headers();
  headers.set("accept", "application/json");
  headers.set("X-Platform-Admin-Key", key);
  const ct = req.headers.get("content-type");
  if (ct) headers.set("content-type", ct);

  const body =
    method === "GET" || method === "DELETE" ? undefined : await req.arrayBuffer().catch(() => undefined);

  const upstream = await fetch(url.toString(), {
    method,
    headers,
    body,
    cache: "no-store",
  });

  const text = await upstream.text();
  return new NextResponse(text || null, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/json",
    },
  });
}
