/** Lê parâmetros da URL /auth no cliente — evita atraso dos props do RSC na navegação. */
export type AuthSearchParams = {
  resetToken?: string;
  modeParam?: string;
  fluxoOrganizador: boolean;
  precisaOrganizador: boolean;
  sessaoExpirada: boolean;
  tipoParam?: string;
  nextParam?: string;
};

export function readAuthSearchParams(search = ""): AuthSearchParams {
  const raw =
    search ||
    (typeof window !== "undefined" ? window.location.search : "");
  const sp = new URLSearchParams(raw.startsWith("?") ? raw.slice(1) : raw);

  return {
    resetToken: sp.get("reset") ?? undefined,
    modeParam: sp.get("mode") ?? undefined,
    fluxoOrganizador: sp.get("fluxo") === "organizador",
    precisaOrganizador: sp.get("precisa") === "organizador",
    sessaoExpirada: sp.get("expirado") === "1",
    tipoParam: sp.get("tipo") ?? undefined,
    nextParam: sp.get("next") ?? undefined,
  };
}

export function resolveAuthMode(params: AuthSearchParams): "login" | "register" | "forgot" | "reset" {
  if (params.resetToken) return "reset";
  if (params.modeParam === "forgot") return "forgot";
  if (params.modeParam === "register") return "register";
  if (params.fluxoOrganizador) return "register";
  return "login";
}
