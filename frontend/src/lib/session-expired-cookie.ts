/** Cookie curto — middleware distingue sessão expirada vs visitante novo em /organizador/novo. */
export const SESSION_EXPIRED_COOKIE = "eventosbr_session_expired";

export const SESSION_EXPIRED_MAX_AGE = 300;

export function markSessionExpiredCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${SESSION_EXPIRED_COOKIE}=1; path=/; max-age=${SESSION_EXPIRED_MAX_AGE}; samesite=lax`;
}
