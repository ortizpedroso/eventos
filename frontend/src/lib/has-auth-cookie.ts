const AUTH_COOKIE = "eventosbr_session";

/** Indica se há cookie de sessão — evita chamada /me desnecessária (flash na /auth). */
export function hasAuthCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split(";").some((c) => c.trim().startsWith(`${AUTH_COOKIE}=`));
}

export { AUTH_COOKIE };
