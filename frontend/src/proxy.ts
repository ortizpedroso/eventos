import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { buildContentSecurityPolicy } from "@/lib/csp";
import { fetchMiddlewareSession } from "@/lib/middleware-api";
import { extractSubdomain, fetchTenantBySubdomain } from "@/lib/organizer-tenant";

const AUTH_COOKIE = "eventosbr_session";
const ADMIN_COOKIE = "eventosbr_admin_key";
/** Evita /me no middleware a cada clique do painel (TTL curto, amarrado ao token). */
const SESSION_CHECKED = "eventosbr_session_ok";
const SESSION_CHECK_TTL = 300;

function clearAuthCookie(response: NextResponse) {
  response.cookies.set(AUTH_COOKIE, "", { path: "/", maxAge: 0 });
  response.cookies.set(SESSION_CHECKED, "", { path: "/", maxAge: 0 });
}

function sessionCheckedValue(token: string, tipo: string): string {
  const prefix = tipo === "organizador" ? "org" : "cli";
  return `${prefix}:${token.slice(0, 16)}`;
}

function readCachedSession(token: string, checked: string | undefined) {
  if (!checked) return null;
  const prefix = token.slice(0, 16);
  if (checked === `org:${prefix}`) return { ok: true as const, tipo: "organizador" };
  if (checked === `cli:${prefix}`) return { ok: true as const, tipo: "cliente" };
  return null;
}

function stampSessionChecked(response: NextResponse, token: string, tipo: string) {
  response.cookies.set(SESSION_CHECKED, sessionCheckedValue(token, tipo), {
    httpOnly: true,
    maxAge: SESSION_CHECK_TTL,
    path: "/",
    sameSite: "lax",
  });
}

function withNonce(request: NextRequest, nonce: string) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  return requestHeaders;
}

function finish(response: NextResponse, nonce: string): NextResponse {
  response.headers.set("x-nonce", nonce);
  if (process.env.NODE_ENV === "production") {
    response.headers.set("Content-Security-Policy", buildContentSecurityPolicy(nonce, false));
  }
  return response;
}

function authLoginRedirect(request: NextRequest, pathname: string, extra?: Record<string, string>) {
  if (pathname === "/organizador/novo" && !extra?.expirado) {
    return new URL("/cadastro", request.url);
  }
  const login = new URL("/auth", request.url);
  login.searchParams.set("next", pathname);
  if (pathname.startsWith("/organizador")) {
    login.searchParams.set("mode", "register");
    login.searchParams.set("fluxo", "organizador");
  }
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      login.searchParams.set(key, value);
    }
  }
  return login;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const headers = withNonce(request, nonce);

  const baseDomain = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN?.trim();
  const host = request.headers.get("host") ?? "";
  if (baseDomain && (pathname === "/" || pathname === "/eventos")) {
    const sub = extractSubdomain(host, baseDomain);
    if (sub) {
      const tenant = await fetchTenantBySubdomain(sub);
      if (tenant?.slug) {
        const dest = new URL(`/produtor/${tenant.slug}`, request.url);
        if (pathname === "/eventos") dest.pathname = `/produtor/${tenant.slug}`;
        return finish(NextResponse.redirect(dest), nonce);
      }
    }
  }

  if (pathname.startsWith("/api/admin/proxy")) {
    if (!request.cookies.get(ADMIN_COOKIE)?.value) {
      return finish(
        NextResponse.json({ detail: "Sessão admin não iniciada." }, { status: 401 }),
        nonce,
      );
    }
    return finish(NextResponse.next({ request: { headers } }), nonce);
  }

  if (
    pathname.startsWith("/admin") &&
    pathname !== "/admin" &&
    pathname !== "/admin/dashboard"
  ) {
    if (!request.cookies.get(ADMIN_COOKIE)?.value) {
      return finish(NextResponse.redirect(new URL("/admin/dashboard", request.url)), nonce);
    }
  }

  const isProtected =
    pathname.startsWith("/organizador") || pathname.startsWith("/conta");

  if (!isProtected) {
    return finish(NextResponse.next({ request: { headers } }), nonce);
  }

  const sessionToken = request.cookies.get(AUTH_COOKIE)?.value;
  if (!sessionToken) {
    return finish(NextResponse.redirect(authLoginRedirect(request, pathname)), nonce);
  }

  let session: { ok: true; tipo?: string } | null = readCachedSession(
    sessionToken,
    request.cookies.get(SESSION_CHECKED)?.value,
  );
  if (!session) {
    const fetched = await fetchMiddlewareSession(sessionToken);
    if (!fetched.ok) {
      const res = NextResponse.redirect(
        authLoginRedirect(request, pathname, { expirado: "1" }),
      );
      clearAuthCookie(res);
      return finish(res, nonce);
    }
    session = { ok: true, tipo: fetched.tipo };
  }

  if (pathname.startsWith("/organizador") && session.tipo !== "organizador") {
    return finish(NextResponse.redirect(new URL("/eventos", request.url)), nonce);
  }

  const response = NextResponse.next({ request: { headers } });
  stampSessionChecked(response, sessionToken, session.tipo ?? "cliente");
  return finish(response, nonce);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
