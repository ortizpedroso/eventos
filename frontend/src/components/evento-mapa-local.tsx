type Props = {
  local: string;
  cidade?: string | null;
};

export function EventoMapaLocal({ local, cidade }: Props) {
  const endereco = [local, cidade].filter(Boolean).join(", ");
  const mapsQuery = encodeURIComponent(endereco);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;
  const embedKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY?.trim();
  // Sem chave configurada (era o caso em produção — mapa nunca embutia, só o
  // link "Abrir no Google Maps"), usa o formato de embed do Google Maps que
  // NÃO exige chave de API (?output=embed) — sempre mostra o mapa na página,
  // como pedido. Com a chave configurada, usa a versão oficial (mais estável).
  const embedSrc = embedKey
    ? `https://www.google.com/maps/embed/v1/place?key=${embedKey}&q=${mapsQuery}`
    : `https://www.google.com/maps?q=${mapsQuery}&output=embed`;

  if (!local?.trim()) return null;

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm" aria-labelledby="local-evento-heading">
      <h2 id="local-evento-heading" className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
        Localização
      </h2>
      <p className="mt-2 text-sm text-zinc-700">{endereco}</p>
      <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200">
        <iframe
          title="Mapa do evento"
          className="h-56 w-full"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          src={embedSrc}
        />
      </div>
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex text-sm font-medium text-emerald-700 underline-offset-2 hover:underline"
      >
        Abrir no Google Maps
      </a>
    </section>
  );
}
