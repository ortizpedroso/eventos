import Link from "next/link";

import { EventoCardVitrine } from "@/components/evento-card-vitrine";
import type { Evento } from "@/lib/types";

type Props = {
  initialEventos?: Evento[] | null;
};

export function HomeEventosDestaque({ initialEventos = null }: Props) {
  const eventos = initialEventos ?? [];

  if (eventos.length === 0) {
    return null;
  }

  return (
    <section className="mx-auto mt-20 max-w-6xl sm:mt-28" aria-labelledby="home-eventos-titulo">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 id="home-eventos-titulo" className="text-3xl font-extrabold tracking-tight text-zinc-900">
            Eventos em destaque
          </h2>
          <p className="mt-2 text-lg text-zinc-600">Confira o que está acontecendo agora na plataforma.</p>
        </div>
        <Link
          href="/eventos"
          className="text-sm font-semibold text-emerald-800 underline-offset-2 hover:underline"
        >
          Ver todos →
        </Link>
      </div>

      <ul className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {eventos.map((e) => (
          <li key={e.id}>
            <EventoCardVitrine evento={e} />
          </li>
        ))}
      </ul>
    </section>
  );
}
