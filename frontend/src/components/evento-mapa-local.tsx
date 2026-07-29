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
      {embedKey ? (
        // Só embute com a chave oficial da Maps Embed API — o formato sem chave
        // (?output=embed) é frequentemente bloqueado pelo próprio Google ("Este
        // conteúdo está bloqueado..."), não é confiável pra produção.
        <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200">
          <iframe
            title="Mapa do evento"
            className="h-56 w-full"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            src={`https://www.google.com/maps/embed/v1/place?key=${embedKey}&q=${mapsQuery}`}
          />
        </div>
      ) : (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 py-8 text-sm font-medium text-emerald-700 hover:bg-zinc-100"
        >
          Ver localização no Google Maps ↗
        </a>
      )}
      {embedKey ? (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex text-sm font-medium text-emerald-700 underline-offset-2 hover:underline"
        >
          Abrir no Google Maps
        </a>
      ) : null}
    </section>
  );
}
