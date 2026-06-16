"use client";

import Link from "next/link";
import { useMemo } from "react";

import {
  TARIFA_PADRAO,
  detalharTaxaIngresso,
  formatBrl,
  formatPercentual,
  parseValorMonetarioInput,
} from "@/lib/tarifas-plataforma";

type Props = {
  /** Preço de venda do ingresso (string do input ou número). */
  preco: string | number;
  /** Ocultar quando evento gratuito. */
  ocultar?: boolean;
  className?: string;
};

/** Estimativa de taxa Asaas (PIX ~0,99%; cartão ~2,99% + R$0,49) — ilustrativo. */
const ASAAS_PIX_EST = 0.0099;
const ASAAS_CARTAO_EST = 0.0299;
const ASAAS_FIXO_CARTAO = 0.49;

export function EventoWizardSimuladorLiquido({ preco, ocultar, className = "" }: Props) {
  const precoNum = useMemo(() => {
    if (typeof preco === "number") return preco;
    return parseValorMonetarioInput(preco);
  }, [preco]);

  const detalhe = useMemo(() => {
    if (precoNum == null || precoNum < 0.5) return null;
    return detalharTaxaIngresso(precoNum, TARIFA_PADRAO);
  }, [precoNum]);

  if (ocultar || !detalhe) return null;

  const taxaPixEst = Math.round(detalhe.precoVenda * ASAAS_PIX_EST * 100) / 100;
  const taxaCartaoEst =
    Math.round((detalhe.precoVenda * ASAAS_CARTAO_EST + ASAAS_FIXO_CARTAO) * 100) / 100;
  const liquidoPixEst = Math.round((detalhe.liquidoOrganizador - taxaPixEst) * 100) / 100;
  const liquidoCartaoEst = Math.round((detalhe.liquidoOrganizador - taxaCartaoEst) * 100) / 100;

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
          <span>Est. taxa Asaas PIX (~0,99%)</span>
          <span>− {formatBrl(taxaPixEst)}</span>
        </li>
        <li className="flex justify-between gap-2 font-medium text-emerald-900">
          <span>Líquido estimado (PIX)</span>
          <span>{formatBrl(Math.max(0, liquidoPixEst))}</span>
        </li>
        <li className="flex justify-between gap-2 text-zinc-500">
          <span>Est. taxa Asaas cartão (~2,99% + R$0,49)</span>
          <span>− {formatBrl(taxaCartaoEst)}</span>
        </li>
        <li className="flex justify-between gap-2 text-zinc-700">
          <span>Líquido estimado (cartão)</span>
          <span className="font-medium">{formatBrl(Math.max(0, liquidoCartaoEst))}</span>
        </li>
      </ul>

      <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
        Valores ilustrativos. Tarifas reais do Asaas variam por método e antecipação. Configure o
        walletId em Financeiro antes de vender ingressos pagos.
      </p>
    </div>
  );
}
