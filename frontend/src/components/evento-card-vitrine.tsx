import Link from "next/link";

import { EventoCategoriaBadge } from "@/components/evento-categoria-badge";
import { resolveEventoImagemSrc } from "@/lib/evento-imagem-url";
import { formatEventoDataHora } from "@/lib/eventos";
import type { Evento } from "@/lib/types";

type Props = {
  evento: Evento;
};

export function EventoCardVitrine({ evento: e }: Props) {
  const fmtInicio = formatEventoDataHora(e.data_inicio);
  const precoNum = e.preco_compra ?? e.preco_ingresso ?? 0;
  const preco = precoNum.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const vendasAbertas = e.compra_disponivel !== false && Boolean(e.lote_compra_id);
  const thumbSrc = resolveEventoImagemSrc(e.imagem_url);

  return (
    <Link
      href={`/eventos/${e.slug}`}
      prefetch
      className="card-interactive flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm hover:border-emerald-600 hover:ring-1 hover:ring-emerald-600"
    >
      {thumbSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbSrc}
          alt={`Imagem do evento ${e.nome}`}
          className="aspect-[16/10] w-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className="aspect-[16/10] w-full bg-gradient-to-br from-emerald-100 to-zinc-100" />
      )}
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-zinc-900 line-clamp-2">{e.nome}</h3>
          <EventoCategoriaBadge categoria={e.categoria} variant="card" />
        </div>
        <p className="mt-2 text-xs text-zinc-600">
          {fmtInicio} · {e.local}
        </p>
        <p className="mt-auto pt-4 text-sm font-semibold text-emerald-800">
          {vendasAbertas ? `A partir de ${preco}` : "Vendas encerradas"}
        </p>
      </div>
    </Link>
  );
}
