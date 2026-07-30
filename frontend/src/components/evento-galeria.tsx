"use client";

import { resolveEventoImagemSrc } from "@/lib/evento-imagem-url";

type Props = {
  urls: string[];
  className?: string;
};

/** Galeria de edições anteriores — só renderiza se houver fotos reais. */
export function EventoGaleria({ urls, className = "" }: Props) {
  const fotos = (urls || []).map((u) => u.trim()).filter(Boolean);
  if (fotos.length === 0) return null;

  return (
    <section
      className={`rounded-xl border border-zinc-200 bg-white p-5 shadow-sm ${className}`}
      aria-labelledby="galeria-evento-titulo"
    >
      <h2 id="galeria-evento-titulo" className="text-lg font-semibold text-zinc-900">
        Edições anteriores
      </h2>
      <p className="mt-1 text-sm text-zinc-500">Fotos enviadas pelo organizador.</p>
      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {fotos.map((url) => {
          const src = resolveEventoImagemSrc(url) || url;
          return (
            <li key={url} className="overflow-hidden rounded-lg bg-zinc-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                className="aspect-[4/3] h-full w-full object-cover"
                loading="lazy"
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
