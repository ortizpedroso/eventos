/** Persistência leve do ?ref= para atribuição no checkout (sem PII). */

const PREFIX = "eventosbr:ref:";

export function storageKeyRef(eventoId: string): string {
  return `${PREFIX}${eventoId}`;
}

export function salvarRefPromoter(eventoId: string, codigo: string): void {
  if (typeof window === "undefined") return;
  const c = codigo.trim();
  if (!eventoId || !c) return;
  try {
    sessionStorage.setItem(storageKeyRef(eventoId), c);
  } catch {
    /* private mode */
  }
}

export function lerRefPromoter(eventoId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = sessionStorage.getItem(storageKeyRef(eventoId));
    return v?.trim() || null;
  } catch {
    return null;
  }
}
