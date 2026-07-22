import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { buildContentSecurityPolicy } from "@/lib/csp";
import { fetchMiddlewareSession } from "@/lib/middleware-api";

const AUTH_COOKIE = "eventosbr_session";
const ADMIN_COOKIE = "eventosbr_admin_key";

function clearAuthCookie(response: NextResponse) {
  response.cookies.set(AUTH_COOKIE, "", { path: "/", maxAge: 0 });
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

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const headers = withNonce(request, nonce);

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
    const login = new URL("/auth", request.url);
    login.searchParams.set("next", pathname);
    return finish(NextResponse.redirect(login), nonce);
  }

  const session = await fetchMiddlewareSession(sessionToken);
  if (!session.ok) {
    const login = new URL("/auth", request.url);
    login.searchParams.set("next", pathname);
    login.searchParams.set("expirado", "1");
    const res = NextResponse.redirect(login);
    clearAuthCookie(res);
    return finish(res, nonce);
  }

  if (pathname.startsWith("/organizador") && session.tipo !== "organizador") {
    return finish(NextResponse.redirect(new URL("/eventos", request.url)), nonce);
  }

  return finish(NextResponse.next({ request: { headers } }), nonce);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
