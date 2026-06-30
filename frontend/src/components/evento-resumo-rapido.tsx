import type { IngressoLote } from "@/lib/types";
import { labelTipoIngresso } from "@/lib/ingresso-tipo-label";
import { INGRESSO_MINIMO_PAGO_REAIS } from "@/lib/taxas-asaas-publicas";
import { labelPagamentoSeguro } from "@/lib/payment-provider";

type Props = {
  fmtInicio: string;
  local: string;
  precoFmt: string;
  precoIngresso?: number;
  loteAtivoNome?: string | null;
  lotes?: IngressoLote[];
  loteCompraId?: string | null;
  compraDisponivel?: boolean;
  motivoCompraIndisponivel?: string | null;
};

export function EventoResumoRapido({
  fmtInicio,
  local,
  precoFmt,
  precoIngresso,
  loteAtivoNome,
  lotes,
  loteCompraId,
  compraDisponivel = true,
  motivoCompraIndisponivel,
}: Props) {
  const sorted = lotes?.slice().sort((a, b) => a.ordem - b.ordem) ?? [];
  const loteAtivo = loteCompraId ? sorted.find((l) => l.id === loteCompraId) : null;
  const pago =
    precoIngresso !== undefined && precoIngresso >= INGRESSO_MINIMO_PAGO_REAIS;

  return (
    <section
      className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5 [&_p]:text-justify"
      aria-label="Resumo do evento"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Data</p>
          <p className="mt-0.5 text-sm font-medium text-zinc-900">{fmtInicio}</p>
        </div>
        <div className="min-w-0 sm:col-span-1 lg:col-span-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Local</p>
          <p className="mt-0.5 line-clamp-2 text-sm font-medium text-zinc-900">{local}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Preço</p>
          <p className="mt-0.5 text-lg font-bold text-emerald-800">{precoFmt}</p>
          {pago ? (
            <p className="text-[11px] text-zinc-600">
              Valor do ingresso. Parcelamento, quando disponível, pode incluir acréscimo no checkout.{" "}
              {labelPagamentoSeguro()}.
            </p>
          ) : (
            <p className="text-[11px] text-zinc-600">Ingresso gratuito ou cortesia.</p>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Lote à venda</p>
          <p className="mt-0.5 text-sm font-medium text-zinc-900">
            {compraDisponivel ? (
              <>
                {loteAtivoNome ?? "Consulte abaixo"}
                {loteAtivo?.tipo ? (
                  <span className="ml-1 text-xs font-normal text-zinc-500">
                    ({labelTipoIngresso(loteAtivo.tipo)})
                  </span>
                ) : null}
              </>
            ) : (
              <span className="text-amber-800">Indisponível</span>
            )}
          </p>
          {!compraDisponivel && motivoCompraIndisponivel ? (
            <p className="mt-1 text-[11px] leading-relaxed text-amber-800">{motivoCompraIndisponivel}</p>
          ) : null}
        </div>
      </div>

      {sorted.length > 0 ? (
        <ul className="mt-4 flex gap-2 overflow-x-auto pb-1 text-xs">
          {sorted.map((l) => {
            const atual = loteCompraId === l.id;
            const gratis = l.tipo === "cortesia" || l.preco <= 0;
            return (
              <li
                key={l.id}
                className={`shrink-0 rounded-full border px-3 py-1 ${
                  atual
                    ? "border-emerald-600 bg-emerald-50 font-medium text-emerald-900"
                    : "border-zinc-200 bg-zinc-50 text-zinc-600"
                }`}
              >
                {l.nome}
                <span className="text-zinc-500"> · {labelTipoIngresso(l.tipo)}</span>
                {" · "}
                {gratis
                  ? "Grátis"
                  : l.preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
