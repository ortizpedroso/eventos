"use client";

import Link from "next/link";

import {
  TARIFA_PADRAO,
  detalharTaxaIngresso,
  formatBrl,
  formatPercentual,
} from "@/lib/tarifas-plataforma";

type Props = {
  precoIngresso: number;
  /** Texto maior no topo (etapa 1). */
  destaque?: boolean;
  className?: string;
};

/**
 * Explica o preço final: valor pago pelo comprador e composição da taxa EventosBR
 * (já embutida no preço da vitrine — sem acréscimo no checkout).
 */
export function CheckoutPrecoDetalhe({ precoIngresso, destaque = false, className = "" }: Props) {
  if (!Number.isFinite(precoIngresso) || precoIngresso < 0.5) {
    return null;
  }

  const d = detalharTaxaIngresso(precoIngresso, TARIFA_PADRAO);
  if (!d) return null;

  return (
    <div
      className={`rounded-md border border-emerald-200 bg-emerald-50/80 text-sm ${destaque ? "px-3 py-3" : "px-3 py-2.5"} ${className}`}
    >
      {destaque ? (
        <>
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-800">Preço final</p>
          <p className="mt-1 text-2xl font-bold text-emerald-900">{formatBrl(d.precoVenda)}</p>
        </>
      ) : (
        <p className="text-sm font-semibold text-emerald-900">Total: {formatBrl(d.precoVenda)}</p>
      )}
      <ul className="mt-2 space-y-1 text-xs text-emerald-950/90">
        <li>
          Você paga <strong>{formatBrl(d.precoVenda)}</strong> — sem taxa extra no checkout.
        </li>
        <li>
          Inclui taxa da plataforma ({formatPercentual(TARIFA_PADRAO.percentual)} +{" "}
          {formatBrl(TARIFA_PADRAO.fixoPorIngresso)} por ingresso):{" "}
          <strong>{formatBrl(d.taxaTotal)}</strong>
        </li>
        <li className="text-emerald-800/80">
          Repasse estimado ao organizador: {formatBrl(d.liquidoOrganizador)} (antes de tarifas do cartão/PIX
          do Stripe).
        </li>
      </ul>
      <p className="mt-2 text-[11px] text-emerald-800/70">
        <Link href="/planos" className="underline underline-offset-2 hover:text-emerald-900">
          Ver planos e taxas
        </Link>
      </p>
    </div>
  );
}
