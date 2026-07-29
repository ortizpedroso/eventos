type Props = {
  local: string;
  cidade?: string | null;
};

export function EventoMapaLocal({ local, cidade }: Props) {
  const endereco = [local, cidade].filter(Boolean).join(", ");
  const mapsQuery = encodeURIComponent(endereco);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;
  const embedKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY?.trim();
  // Spec P16: mapa sempre embutido, sem depender de chave de API configurada.
  // Com a chave oficial (Maps Embed API) usamos a versão mais estável; sem
  // ela, caímos no formato de embed público (?output=embed) — o Google às
  // vezes mostra "Este conteúdo está bloqueado" dentro do iframe nesse modo
  // (não é um erro de rede, então `onError` não detecta), por isso o link
  // "Abrir no Google Maps" fica sempre visível abaixo como saída garantida.
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
        Abrir no Google Maps ↗
      </a>
    </section>
  );
}
