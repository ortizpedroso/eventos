import type { IngressoTipo } from "@/lib/types";

const LABELS: Record<IngressoTipo, string> = {
  inteira: "Inteira",
  meia: "Meia-entrada",
  vip: "VIP",
  cortesia: "Cortesia",
};

/** Rótulo legível do tipo de ingresso/lote. */
export function labelTipoIngresso(tipo?: IngressoTipo | string | null): string {
  if (!tipo) return LABELS.inteira;
  return LABELS[tipo as IngressoTipo] ?? String(tipo);
}
