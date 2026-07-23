/** Cache em memória — evita skeleton ao alternar rotas do painel do organizador. */
const cache = new Map<string, unknown>();

export function readOrganizadorCache<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined;
}

export function writeOrganizadorCache<T>(key: string, value: T): void {
  cache.set(key, value);
}

export const ORGANIZADOR_CACHE_KEYS = {
  eventos: "org:eventos",
  relatorios: "org:relatorios",
  financeiro: "org:financeiro",
} as const;
