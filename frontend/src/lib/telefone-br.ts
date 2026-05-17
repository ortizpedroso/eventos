import { onlyDigits } from "@/lib/cpf";

const MAX = 11;

/** Formata (DD) NNNNN-NNNN (11 dígitos) ou (DD) NNNN-NNNN (10 dígitos). */
export function formatTelefoneBrMask(digits: string): string {
  const d = onlyDigits(digits, MAX);
  if (!d) return "";
  if (d.length <= 2) return `(${d}`;
  const ddd = d.slice(0, 2);
  const r = d.slice(2);
  if (d.length <= 6) return `(${ddd}) ${r}`;
  if (d.length <= 10) {
    if (r.length <= 4) return `(${ddd}) ${r}`;
    return `(${ddd}) ${r.slice(0, 4)}-${r.slice(4)}`;
  }
  return `(${ddd}) ${r.slice(0, 5)}-${r.slice(5)}`;
}

/** DDD + número: 10 (fixo) ou 11 (celular com 9). */
export function isTelefoneBrasilOk(digits: string): boolean {
  const n = onlyDigits(digits, MAX).length;
  return n >= 10 && n <= 11;
}
