/** Cache leve em memória para evitar flash ao alternar abas da conta. */
const cache = new Map<string, unknown>();

export function readContaCache<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined;
}

export function writeContaCache<T>(key: string, value: T): void {
  cache.set(key, value);
}

export const CONTA_CACHE_KEYS = {
  perfil: "conta:perfil",
  pagamentos: "conta:pagamentos",
  ingressos: "conta:ingressos",
  notificacoes: "conta:notificacoes",
} as const;
