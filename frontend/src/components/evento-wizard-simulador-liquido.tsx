"use client";

import {
  TARIFA_PADRAO,
  detalharTaxaIngresso,
  formatBrl,
  rotuloTaxa,
} from "@/lib/tarifas-plataforma";
import { calcularAcrescimoParcelamento } from "@/lib/taxas-asaas-publicas";

type Props = {
  preco: string | number;
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
  const precoNum =
    typeof preco === "number"
      ? preco
      : Number.parseFloat(preco.trim().replace(/\./g, "").replace(",", ".")) || null;

  if (ocultar || precoNum == null || precoNum < 0.5) return null;

  const detalhe = detalharTaxaIngresso(precoNum, TARIFA_PADRAO);
  if (!detalhe) return null;

  const maxParcelas = Math.min(12, Math.max(2, parcelamentoMax || 2));
  const acrescimo12 = parcelamentoHabilitado
    ? calcularAcrescimoParcelamento(precoNum, maxParcelas)
    : 0;

  return (
    <div
      className={`rounded-xl border border-emerald-200 bg-gradient-to-b from-white to-emerald-50/60 p-4 ring-1 ring-emerald-200/70 ${className}`}
    >
      <p className="text-sm font-semibold text-zinc-900">Quanto você recebe por ingresso</p>
      <p className="mt-1 text-xs text-zinc-600">
        Taxa EventosBR fixa ({rotuloTaxa(TARIFA_PADRAO)}) — igual para PIX, cartão ou parcelamento.
      </p>
      <ul className="mt-4 space-y-1.5 text-xs text-zinc-600">
        <li className="flex justify-between gap-2">
          <span>Preço de venda</span>
          <span className="font-semibold text-zinc-900">{formatBrl(detalhe.precoVenda)}</span>
        </li>
        <li className="flex justify-between gap-2">
          <span>Taxa EventosBR</span>
          <span>− {formatBrl(detalhe.taxaTotal)}</span>
        </li>
        <li className="flex justify-between gap-2 border-t border-dashed border-zinc-200 pt-1.5 font-medium text-emerald-900">
          <span>Você recebe</span>
          <span>{formatBrl(detalhe.liquidoOrganizador)}</span>
        </li>
        {parcelamentoHabilitado && acrescimo12 > 0 ? (
          <li className="flex justify-between gap-2 text-amber-900">
            <span>Acréscimo ao comprador ({maxParcelas}x, ref.)</span>
            <span>+ {formatBrl(acrescimo12)}</span>
          </li>
        ) : null}
      </ul>
    </div>
  );
}
