import { apiFetch } from "@/lib/api";
import type { PagamentoListItem } from "@/lib/types";

export async function contarPagamentosPendentes(): Promise<number> {
  try {
    const items = await apiFetch<PagamentoListItem[]>("/api/pagamentos/meus", {
      cache: "no-store",
    });
    return items.filter((i) => i.status === "pendente" && i.reservado_ate).length;
  } catch {
    return 0;
  }
}
