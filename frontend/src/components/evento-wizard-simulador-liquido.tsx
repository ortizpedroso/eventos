"use client";

import {
  TARIFA_PADRAO,
  detalharTaxaIngresso,
  formatBrl,
  rotuloTaxa,
} from "@/lib/tarifas-plataforma";
import {
  AVISO_LEGAL_TAXAS,
  calcularAcrescimoParcelamento,
  type RepasseParcelamento,
} from "@/lib/taxas-asaas-publicas";

type Props = {
  preco: string | number;
  ocultar?: boolean;
  className?: string;
  parcelamentoHabilitado?: boolean;
  parcelamentoMax?: number;
  repasseParcelamento?: RepasseParcelamento;
};

export function EventoWizardSimuladorLiquido({
  preco,
  ocultar,
  className = "",
  parcelamentoHabilitado = false,
  parcelamentoMax = 2,
  repasseParcelamento = "comprador",
}: Props) {
  const precoNum =
    typeof preco === "number"
      ? preco
      : Number.parseFloat(preco.trim().replace(/\./g, "").replace(",", ".")) || null;

  if (ocultar || precoNum == null || precoNum < 10) return null;

  const detalhe = detalharTaxaIngresso(precoNum, TARIFA_PADRAO);
  if (!detalhe) return null;

  const maxParcelas = Math.min(12, Math.max(2, parcelamentoMax || 2));
  const acrescimo = parcelamentoHabilitado
    ? calcularAcrescimoParcelamento(precoNum, maxParcelas)
    : 0;
  const liquidoAbsorvendo =
    repasseParcelamento === "organizador" && acrescimo > 0
      ? Math.max(0, detalhe.liquidoOrganizador - acrescimo)
      : detalhe.liquidoOrganizador;

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
        {parcelamentoHabilitado && acrescimo > 0 && repasseParcelamento === "organizador" ? (
          <li className="flex justify-between gap-2 text-amber-900">
            <span>Acréscimo parcelamento ({maxParcelas}x, você absorve)</span>
            <span>− {formatBrl(acrescimo)}</span>
          </li>
        ) : null}
        <li className="flex justify-between gap-2 border-t border-dashed border-zinc-200 pt-1.5 font-medium text-emerald-900">
          <span>Você recebe</span>
          <span>{formatBrl(liquidoAbsorvendo)}</span>
        </li>
        {parcelamentoHabilitado && acrescimo > 0 && repasseParcelamento === "comprador" ? (
          <li className="flex justify-between gap-2 text-amber-900">
            <span>Acréscimo ao comprador ({maxParcelas}x, ref.)</span>
            <span>+ {formatBrl(acrescimo)}</span>
          </li>
        ) : null}
      </ul>
      <p className="mt-3 text-[11px] text-zinc-500">{AVISO_LEGAL_TAXAS}</p>
    </div>
  );
}
