import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_COOKIE = "eventosbr_session";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected =
    pathname.startsWith("/organizador") ||
    pathname.startsWith("/conta");

  if (!isProtected) {
    return NextResponse.next();
  }

  if (!request.cookies.get(AUTH_COOKIE)?.value) {
    const login = new URL("/auth", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/organizador/:path*", "/conta/:path*"],
};
