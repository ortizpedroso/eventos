import { onlyDigits } from "@/lib/cpf";

/** Máscara visual 00000-000. */
export function formatCepMask(digits: string): string {
  const d = onlyDigits(digits, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}
