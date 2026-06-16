import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { fetchMiddlewareSession } from "@/lib/middleware-api";

const AUTH_COOKIE = "eventosbr_session";
const ADMIN_COOKIE = "eventosbr_admin_key";

function clearAuthCookie(response: NextResponse) {
  response.cookies.set(AUTH_COOKIE, "", { path: "/", maxAge: 0 });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/admin/proxy")) {
    if (!request.cookies.get(ADMIN_COOKIE)?.value) {
      return NextResponse.json({ detail: "Sessão admin não iniciada." }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (
    pathname.startsWith("/admin") &&
    pathname !== "/admin" &&
    pathname !== "/admin/dashboard"
  ) {
    if (!request.cookies.get(ADMIN_COOKIE)?.value) {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    }
  }

  const isProtected =
    pathname.startsWith("/organizador") || pathname.startsWith("/conta");

  if (!isProtected) {
    return NextResponse.next();
  }

  const sessionToken = request.cookies.get(AUTH_COOKIE)?.value;
  if (!sessionToken) {
    const login = new URL("/auth", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  const session = await fetchMiddlewareSession(sessionToken);
  if (!session.ok) {
    const login = new URL("/auth", request.url);
    login.searchParams.set("next", pathname);
    login.searchParams.set("expirado", "1");
    const res = NextResponse.redirect(login);
    clearAuthCookie(res);
    return res;
  }

  if (pathname.startsWith("/organizador") && session.tipo !== "organizador") {
    return NextResponse.redirect(new URL("/eventos", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/organizador/:path*",
    "/conta/:path*",
    "/api/admin/proxy/:path*",
    "/admin/:path*",
  ],
};
