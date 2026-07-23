import Link from "next/link";

import { EventoCategoriaIcon } from "@/components/evento-categoria-icon";
import {
  EVENTO_CATEGORIAS_DESTAQUE,
  resolverMetaCategoria,
  urlEventosPorCategoria,
} from "@/lib/evento-categorias";

export function HomeHeroExplorar() {
  return (
    <div className="mx-auto mt-10 w-full max-w-2xl">
      <p className="text-center text-sm font-medium text-zinc-600">O que você procura?</p>
      <div
        className="mt-3 flex flex-wrap justify-center gap-2"
        aria-label="Explorar eventos por categoria"
      >
        {EVENTO_CATEGORIAS_DESTAQUE.map((cat) => {
          const meta = resolverMetaCategoria(cat);
          return (
            <Link
              key={cat}
              href={urlEventosPorCategoria(cat)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset transition-colors hover:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${meta.chip}`}
            >
              <EventoCategoriaIcon categoria={cat} />
              {cat}
            </Link>
          );
        })}
      </div>
      <p className="mt-4 text-center text-sm text-zinc-500">
        <Link
          href="/eventos"
          className="font-medium text-emerald-800 underline-offset-2 hover:underline"
        >
          Ver todos os eventos e buscar por nome
        </Link>
      </p>
    </div>
  );
}
