import type { Evento } from "@/lib/types";

/** Padrões de eventos de teste/demo que não devem aparecer na vitrine pública. */
const PADROES_TESTE = [
  /\bcortesia\s*gr[aá]tis\b/i,
  /\bevento\s*cortesia\b/i,
  /\bru[aá]\s*teste\b/i,
  /\bteste\s+stripe\b/i,
  /\be2e\b/i,
  /^teste\b/i,
  /\bteste\s+pix\b/i,
  /\bevento\s+teste\b/i,
];

export function eventoPareceTeste(evento: Pick<Evento, "nome" | "local" | "slug">): boolean {
  const texto = `${evento.nome} ${evento.local ?? ""} ${evento.slug}`;
  return PADROES_TESTE.some((re) => re.test(texto));
}

/** Remove eventos que parecem dados de teste da listagem pública. */
export function filtrarEventosVitrine(eventos: Evento[]): Evento[] {
  return eventos.filter((e) => !eventoPareceTeste(e));
}
