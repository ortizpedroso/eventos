type Props = {
  local: string;
  cidade?: string | null;
};

export function EventoMapaLocal({ local, cidade }: Props) {
  const endereco = [local, cidade].filter(Boolean).join(", ");
  const mapsQuery = encodeURIComponent(endereco);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;
  const embedKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY?.trim();

  if (!local?.trim()) return null;

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm" aria-labelledby="local-evento-heading">
      <h2 id="local-evento-heading" className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
        Localização
      </h2>
      <p className="mt-2 text-sm text-zinc-700">{endereco}</p>
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex text-sm font-medium text-emerald-800 underline-offset-2 hover:underline"
      >
        Abrir no Google Maps
      </a>
      {embedKey ? (
        <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200">
          <iframe
            title="Mapa do evento"
            className="h-56 w-full"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            src={`https://www.google.com/maps/embed/v1/place?key=${embedKey}&q=${mapsQuery}`}
          />
        </div>
      ) : null}
    </section>
  );
}
