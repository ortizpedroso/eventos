"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { EventoCardVitrine } from "@/components/evento-card-vitrine";
import { EventosGridSkeleton } from "@/components/eventos-grid-skeleton";
import { apiFetch } from "@/lib/api";
import { eventosDestaqueHome } from "@/lib/eventos-publicos";
import type { Evento } from "@/lib/types";

type Props = {
  /** Pré-carregados no servidor para aparecer sem esperar o JavaScript. */
  initialEventos?: Evento[] | null;
};

export function HomeEventosDestaque({ initialEventos = null }: Props) {
  const [eventos, setEventos] = useState<Evento[] | null>(initialEventos);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiFetch<Evento[]>("/api/eventos?limit=12", { cache: "no-store" });
        if (cancelled) return;
        setEventos(eventosDestaqueHome(data));
      } catch {
        if (!cancelled) setEventos((prev) => (prev === null ? [] : prev));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (eventos === null) {
    return (
      <section className="mx-auto mt-20 max-w-6xl sm:mt-28" aria-labelledby="home-eventos-titulo">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2 id="home-eventos-titulo" className="text-3xl font-extrabold tracking-tight text-zinc-900">
              Eventos em destaque
            </h2>
            <p className="mt-2 text-lg text-zinc-600">Confira o que está acontecendo agora na plataforma.</p>
          </div>
        </div>
        <div className="mt-10">
          <EventosGridSkeleton count={3} />
        </div>
      </section>
    );
  }

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
          <p className="mt-2 text-lg text-zinc-600">
            Confira o que está acontecendo agora na plataforma.
          </p>
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
