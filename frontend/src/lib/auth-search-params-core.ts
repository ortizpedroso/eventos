function nextRequerContaOrganizador(path: string): boolean {
  return path === "/organizador" || path.startsWith("/organizador/");
}

function normalizeAuthNext(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const decoded = decodeURIComponent(raw.trim());
    return decoded.startsWith("/") ? decoded : `/${decoded}`;
  } catch {
    return raw.startsWith("/") ? raw : `/${raw}`;
  }
}

/** Parâmetros /auth derivados da query string. */
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

  const nextParam = normalizeAuthNext(sp.get("next") ?? undefined);
  const fluxoOrganizador =
    sp.get("fluxo") === "organizador" ||
    Boolean(nextParam && nextRequerContaOrganizador(nextParam));

  return {
    resetToken: sp.get("reset") ?? undefined,
    modeParam: sp.get("mode") ?? undefined,
    fluxoOrganizador,
    precisaOrganizador: sp.get("precisa") === "organizador",
    sessaoExpirada: sp.get("expirado") === "1",
    tipoParam: sp.get("tipo") ?? undefined,
    nextParam,
  };
}

/** Deriva mode/fluxo quando a URL só traz next=/organizador/… (links antigos ou enxutos). */
export function enrichAuthSearchParams(
  params: AuthSearchParams,
  forcarLogin = false,
): AuthSearchParams {
  const destinoOrganizador = Boolean(
    params.nextParam && nextRequerContaOrganizador(params.nextParam),
  );
  return {
    ...params,
    fluxoOrganizador: params.fluxoOrganizador || destinoOrganizador,
    modeParam:
      params.modeParam ??
      (forcarLogin || !destinoOrganizador ? undefined : "register"),
  };
}

export function resolveAuthMode(
  params: AuthSearchParams,
  forcarLogin = false,
): "login" | "register" | "forgot" | "reset" {
  if (forcarLogin) return "login";
  if (params.resetToken) return "reset";
  if (params.modeParam === "forgot") return "forgot";
  if (params.modeParam === "register") return "register";
  if (params.fluxoOrganizador) return "register";
  if (params.nextParam && nextRequerContaOrganizador(params.nextParam)) return "register";
  return "login";
}
