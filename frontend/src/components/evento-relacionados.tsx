"use client";

import { useEffect, useState } from "react";
import { EventoCardVitrine } from "@/components/evento-card-vitrine";
import { apiFetch } from "@/lib/api";
import type { Evento } from "@/lib/types";

type Props = {
  slug: string;
};

export function EventoRelacionados({ slug }: Props) {
  const [eventos, setEventos] = useState<Evento[]>([]);

  useEffect(() => {
    let cancelled = false;
    void apiFetch<Evento[]>(`/api/eventos/${encodeURIComponent(slug)}/relacionados`)
      .then((data) => {
        if (!cancelled) setEventos(data);
      })
      .catch(() => {
        if (!cancelled) setEventos([]);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (eventos.length === 0) return null;

  return (
    <section className="mt-12" aria-labelledby="relacionados-heading">
      <h2 id="relacionados-heading" className="text-lg font-semibold text-zinc-900">
        Você também pode gostar
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {eventos.map((e) => (
          <EventoCardVitrine key={e.id} evento={e} />
        ))}
      </div>
    </section>
  );
}
