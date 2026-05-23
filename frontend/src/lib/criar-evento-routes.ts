/** Após login/cadastro como organizador, formulário de novo evento (painel). */
export const CRIAR_EVENTO_DESTINO = "/organizador/novo";

const ALLOWED_NEXT_PREFIXES = ["/", "/eventos", "/conta", "/organizador", "/auth"] as const;

/** Abre o cadastro já como organizador, com destino após sucesso = criar evento. */
export function authHrefRegisterOrganizadorParaCriarEvento(): string {
  const p = new URLSearchParams();
  p.set("mode", "register");
  p.set("next", CRIAR_EVENTO_DESTINO);
  p.set("fluxo", "organizador");
  return `/auth?${p.toString()}`;
}

export function authHrefParaCriarEvento(): string {
  const p = new URLSearchParams();
  p.set("next", CRIAR_EVENTO_DESTINO);
  p.set("fluxo", "organizador");
  return `/auth?${p.toString()}`;
}

export function authHrefPrecisaContaOrganizador(nextPath: string = CRIAR_EVENTO_DESTINO): string {
  const p = new URLSearchParams();
  p.set("mode", "register");
  p.set("next", nextPath);
  p.set("fluxo", "organizador");
  p.set("precisa", "organizador");
  return `/auth?${p.toString()}`;
}

export function isSafeInternalNext(path: string | null): path is string {
  if (!path || path.length < 2 || !path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  if (path.includes("\\") || path.includes("://")) return false;
  if (path.includes("%") || path.includes("@")) return false;
  if (/[\u0000-\u001f\u007f]/.test(path)) return false;
  try {
    const decoded = decodeURIComponent(path);
    if (decoded.includes("://") || decoded.startsWith("//")) return false;
  } catch {
    return false;
  }
  return true;
}

export function isAllowedNextPath(path: string): boolean {
  if (!isSafeInternalNext(path)) return false;
  if (path === "/") return true;
  return ALLOWED_NEXT_PREFIXES.some(
    (prefix) => prefix !== "/" && (path === prefix || path.startsWith(`${prefix}/`)),
  );
}

export function nextRequerContaOrganizador(path: string): boolean {
  return path === "/organizador" || path.startsWith("/organizador/");
}

export function authHrefParaComprarIngresso(
  eventoSlug: string,
  mode?: "login" | "register",
): string {
  const p = new URLSearchParams();
  p.set("next", `/eventos/${encodeURIComponent(eventoSlug.trim())}`);
  if (mode === "register") p.set("mode", "register");
  return `/auth?${p.toString()}`;
}

export function destinoPosAuth(
  usuario: { tipo: string },
  next: string | null,
): string {
  if (!next || !isAllowedNextPath(next)) {
    return usuario.tipo === "organizador" ? "/organizador/eventos" : "/";
  }
  if (usuario.tipo === "organizador") {
    return next;
  }
  if (nextRequerContaOrganizador(next)) {
    return "/";
  }
  return next;
}
