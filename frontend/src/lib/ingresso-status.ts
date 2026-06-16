/** Rótulos amigáveis para status de ingresso/pagamento. */

const LABELS: Record<string, string> = {
  pendente: "Aguardando pagamento",
  pago: "Confirmado",
  usado: "Utilizado na entrada",
  cancelado: "Cancelado",
};

export function labelStatusIngresso(status: string): string {
  return LABELS[status] ?? status;
}

export function classeBadgeStatus(status: string): string {
  switch (status) {
    case "pago":
      return "bg-emerald-100 text-emerald-800";
    case "pendente":
      return "bg-amber-100 text-amber-900";
    case "usado":
      return "bg-zinc-200 text-zinc-800";
    case "cancelado":
      return "bg-red-100 text-red-800";
    default:
      return "bg-zinc-100 text-zinc-700";
  }
}
