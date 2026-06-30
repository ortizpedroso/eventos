import { cache } from "react";

import { apiFetch } from "@/lib/api";
import type { Evento } from "@/lib/types";

export async function fetchEventosPublicos(
  limit = 50,
  opts?: { q?: string; categoria?: string; cidade?: string; de?: string; ate?: string },
): Promise<Evento[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (opts?.q) params.set("q", opts.q);
  if (opts?.categoria) params.set("categoria", opts.categoria);
  if (opts?.cidade) params.set("cidade", opts.cidade);
  if (opts?.de) params.set("de", opts.de);
  if (opts?.ate) params.set("ate", opts.ate);
  return apiFetch<Evento[]>(`/api/eventos?${params.toString()}`, { cache: "no-store" });
}

/** Até 6 eventos para a homepage — prioriza os com vendas abertas. */
export function eventosDestaqueHome(eventos: Evento[]): Evento[] {
  const abertos = eventos.filter((e) => e.compra_disponivel !== false && Boolean(e.lote_compra_id));
  return (abertos.length >= 3 ? abertos : eventos).slice(0, 6);
}

export async function fetchEventoBySlug(slug: string): Promise<Evento> {
  return apiFetch<Evento>(`/api/eventos/${encodeURIComponent(slug)}`, { cache: "no-store" });
}

/** Uma única chamada por request SSR (metadata + página do evento). */
export const getEventoPublicoBySlug = cache(fetchEventoBySlug);
