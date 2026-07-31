/** Persistência do ?ref= para atribuição no checkout (sem PII). TTL 24h. */

const PREFIX = "eventosbr:ref:";
const TTL_MS = 24 * 60 * 60 * 1000;

type RefStored = { codigo: string; exp: number };

export function storageKeyRef(eventoId: string): string {
  return `${PREFIX}${eventoId}`;
}

export function salvarRefPromoter(eventoId: string, codigo: string): void {
  if (typeof window === "undefined") return;
  const c = codigo.trim();
  if (!eventoId || !c) return;
  try {
    const payload: RefStored = { codigo: c, exp: Date.now() + TTL_MS };
    localStorage.setItem(storageKeyRef(eventoId), JSON.stringify(payload));
  } catch {
    /* private mode */
  }
}

export function lerRefPromoter(eventoId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKeyRef(eventoId));
    if (!raw?.trim()) return null;
    const parsed = JSON.parse(raw) as RefStored;
    if (!parsed?.codigo || typeof parsed.exp !== "number") {
      localStorage.removeItem(storageKeyRef(eventoId));
      return null;
    }
    if (Date.now() > parsed.exp) {
      localStorage.removeItem(storageKeyRef(eventoId));
      return null;
    }
    const c = String(parsed.codigo).trim();
    return c || null;
  } catch {
    try {
      localStorage.removeItem(storageKeyRef(eventoId));
    } catch {
      /* ignore */
    }
    return null;
  }
}

export function limparRefPromoter(eventoId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(storageKeyRef(eventoId));
  } catch {
    /* private mode */
  }
}
