"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  TARIFA_PADRAO,
  detalharTaxaIngresso,
  formatBrl,
  formatPercentual,
  parseValorMonetarioInput,
} from "@/lib/tarifas-plataforma";
import { AVISO_LEGAL_TAXAS, TAXA_PIX, calcularTaxaAsaas } from "@/lib/taxas-asaas-publicas";

type Props = {
  /** Preço de venda do ingresso (string do input ou número). */
  preco: string | number;
  /** Ocultar quando evento gratuito. */
  ocultar?: boolean;
  className?: string;
  parcelamentoHabilitado?: boolean;
  parcelamentoMax?: number;
};

export function EventoWizardSimuladorLiquido({
  preco,
  ocultar,
  className = "",
  parcelamentoHabilitado = false,
  parcelamentoMax = 2,
}: Props) {
  const [parcelasSim, setParcelasSim] = useState(2);

  const precoNum = useMemo(() => {
    if (typeof preco === "number") return preco;
    return parseValorMonetarioInput(preco);
  }, [preco]);

  const detalhe = useMemo(() => {
    if (precoNum == null || precoNum < 0.5) return null;
    return detalharTaxaIngresso(precoNum, TARIFA_PADRAO);
  }, [precoNum]);

  const maxParcelas = Math.min(12, Math.max(2, parcelamentoMax || 2));

  if (ocultar || !detalhe) return null;

  const taxaPixEst = calcularTaxaAsaas(detalhe.precoVenda, "pix");
  const taxaCartaoEst = calcularTaxaAsaas(detalhe.precoVenda, "cartao_avista");
  const parcelasAtivas = parcelamentoHabilitado ? Math.min(parcelasSim, maxParcelas) : 1;
  const taxaParceladoEst =
    parcelamentoHabilitado && parcelasAtivas > 1
      ? calcularTaxaAsaas(detalhe.precoVenda, "cartao_parcelado", parcelasAtivas)
      : null;
  const liquidoPixEst = Math.round((detalhe.liquidoOrganizador - taxaPixEst) * 100) / 100;
  const liquidoCartaoEst = Math.round((detalhe.liquidoOrganizador - taxaCartaoEst) * 100) / 100;
  const liquidoParceladoEst =
    taxaParceladoEst != null
      ? Math.round((detalhe.liquidoOrganizador - taxaParceladoEst) * 100) / 100
      : null;

  return (
    <div
      className={`rounded-xl border border-emerald-200 bg-gradient-to-b from-white to-emerald-50/60 p-4 ring-1 ring-emerald-200/70 ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-zinc-900">Quanto você recebe por ingresso</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-600">
            Estimativa após taxa EventosBR ({formatPercentual(TARIFA_PADRAO.percentual)} +{" "}
            {formatBrl(TARIFA_PADRAO.fixoPorIngresso)}) e tarifas ilustrativas do Asaas.
          </p>
        </div>
        <Link
          href="/organizador/financeiro"
          className="shrink-0 text-xs font-medium text-emerald-800 underline-offset-2 hover:underline"
        >
          Simulador completo
        </Link>
      </div>

      <ul className="mt-4 space-y-1.5 text-xs text-zinc-600">
        <li className="flex justify-between gap-2">
          <span>Preço de venda</span>
          <span className="font-semibold text-zinc-900">{formatBrl(detalhe.precoVenda)}</span>
        </li>
        <li className="flex justify-between gap-2">
          <span>Taxa EventosBR</span>
          <span className="font-medium text-zinc-800">− {formatBrl(detalhe.taxaTotal)}</span>
        </li>
        <li className="flex justify-between gap-2 border-t border-dashed border-zinc-200 pt-1.5">
          <span className="font-medium text-zinc-700">Líquido antes do Asaas</span>
          <span className="font-semibold text-emerald-800">{formatBrl(detalhe.liquidoOrganizador)}</span>
        </li>
        <li className="flex justify-between gap-2 text-zinc-500">
          <span>Est. taxa Asaas PIX ({formatBrl(TAXA_PIX)})</span>
          <span>− {formatBrl(taxaPixEst)}</span>
        </li>
        <li className="flex justify-between gap-2 font-medium text-emerald-900">
          <span>Líquido estimado (PIX)</span>
          <span>{formatBrl(Math.max(0, liquidoPixEst))}</span>
        </li>
        <li className="flex justify-between gap-2 text-zinc-500">
          <span>Est. taxa Asaas cartão à vista</span>
          <span>− {formatBrl(taxaCartaoEst)}</span>
        </li>
        <li className="flex justify-between gap-2 text-zinc-700">
          <span>Líquido estimado (cartão à vista)</span>
          <span className="font-medium">{formatBrl(Math.max(0, liquidoCartaoEst))}</span>
        </li>
        {parcelamentoHabilitado && taxaParceladoEst != null && liquidoParceladoEst != null ? (
          <>
            <li className="flex justify-between gap-2 border-t border-dashed border-zinc-200 pt-1.5 text-zinc-500">
              <span>Est. taxa Asaas cartão {parcelasAtivas}x</span>
              <span>− {formatBrl(taxaParceladoEst)}</span>
            </li>
            <li className="flex justify-between gap-2 font-medium text-amber-900">
              <span>Líquido estimado (parcelado {parcelasAtivas}x)</span>
              <span>{formatBrl(Math.max(0, liquidoParceladoEst))}</span>
            </li>
          </>
        ) : null}
      </ul>

      {parcelamentoHabilitado ? (
        <label className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-700">
          Simular parcelamento:
          <select
            value={parcelasSim}
            onChange={(e) => setParcelasSim(Number(e.target.value))}
            className="rounded border border-zinc-300 px-2 py-1 text-xs"
          >
            {[2, 3, 6, 12].filter((n) => n <= maxParcelas).map((n) => (
              <option key={n} value={n}>
                {n}x
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">{AVISO_LEGAL_TAXAS}</p>
    </div>
  );
}
