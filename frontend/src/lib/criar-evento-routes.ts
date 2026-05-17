/** Após login/cadastro como organizador, formulário de novo evento (painel). */
export const CRIAR_EVENTO_DESTINO = "/organizador/novo";

/** Abre o cadastro já como organizador, com destino após sucesso = criar evento. */
export function authHrefRegisterOrganizadorParaCriarEvento(): string {
  const p = new URLSearchParams();
  p.set("mode", "register");
  p.set("next", CRIAR_EVENTO_DESTINO);
  p.set("fluxo", "organizador");
  return `/auth?${p.toString()}`;
}

/**
 * Link para quem ainda não está autenticado como organizador:
 * entra ou cadastra (como organizador) e só então cria o evento.
 */
export function authHrefParaCriarEvento(): string {
  const p = new URLSearchParams();
  p.set("next", CRIAR_EVENTO_DESTINO);
  p.set("fluxo", "organizador");
  return `/auth?${p.toString()}`;
}

/** Conta autenticada que não é organizador tentou acessar criação de evento. */
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
  return true;
}
