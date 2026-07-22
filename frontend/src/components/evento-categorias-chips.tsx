"use client";

import Link from "next/link";

import { EventoCategoriaIcon } from "@/components/evento-categoria-icon";
import {
  EVENTO_CATEGORIAS,
  resolverMetaCategoria,
  urlEventosPorCategoria,
  type EventoCategoria,
} from "@/lib/evento-categorias";

type Props = {
  /** Subconjunto ou lista completa; default = todas as categorias. */
  categorias?: readonly string[];
  /** Categoria ativa (filtro) — destaca o chip correspondente. */
  ativa?: string;
  /** Se informado, chips disparam callback em vez de navegar (filtro local). */
  onSelecionar?: (categoria: string) => void;
  /** Mostrar chip "Todas" no início. */
  mostrarTodas?: boolean;
  /** `wrap` = todas visíveis em várias linhas; `scroll` = carrossel horizontal (home/nav). */
  layout?: "scroll" | "wrap";
  /** Rótulo acessível da barra. */
  ariaLabel?: string;
  className?: string;
};

export function EventoCategoriasChips({
  categorias = EVENTO_CATEGORIAS,
  ativa = "",
  onSelecionar,
  mostrarTodas = false,
  layout = "scroll",
  ariaLabel = "Filtrar por categoria",
  className = "",
}: Props) {
  const itens = mostrarTodas ? (["", ...categorias] as const) : categorias;

  const containerClass =
    layout === "wrap"
      ? "flex flex-wrap gap-2"
      : "flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

  return (
    <div
      className={`${containerClass} ${className}`}
      role={onSelecionar ? "group" : undefined}
      aria-label={ariaLabel}
    >
      {itens.map((cat) => {
        const label = cat === "" ? "Todas" : cat;
        const isAtivo = cat === ativa;
        const meta = cat ? resolverMetaCategoria(cat) : null;
        const chipClass = isAtivo
          ? cat
            ? meta!.chipAtivo
            : "bg-emerald-700 text-white ring-emerald-800 shadow-sm"
          : cat
            ? meta!.chip
            : "bg-zinc-50 text-zinc-700 ring-zinc-200/70 hover:bg-zinc-100";

        const base =
          "card-interactive inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2";

        if (onSelecionar) {
          return (
            <button
              key={label}
              type="button"
              aria-pressed={isAtivo}
              onClick={() => onSelecionar(cat)}
              className={`${base} ${chipClass}`}
            >
              {cat ? <EventoCategoriaIcon categoria={cat} /> : null}
              {label}
            </button>
          );
        }

        const href = urlEventosPorCategoria(cat);
        return (
          <Link
            key={label}
            href={href}
            aria-current={isAtivo ? "page" : undefined}
            className={`${base} ${chipClass}`}
          >
            {cat ? <EventoCategoriaIcon categoria={cat} /> : null}
            {label}
          </Link>
        );
      })}
    </div>
  );
}

/** Chips compactos para navbar/home — só categorias em destaque. */
export function EventoCategoriasDestaqueChips({
  categorias,
  className = "",
}: {
  categorias: readonly EventoCategoria[];
  className?: string;
}) {
  return (
    <EventoCategoriasChips
      categorias={categorias}
      ariaLabel="Explorar categorias de eventos"
      className={className}
    />
  );
}
