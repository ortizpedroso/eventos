"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { InputValorBrl } from "@/components/input-valor-brl";
import {
  TARIFA_ASSINATURA,
  TARIFA_PADRAO,
  type PlanoTarifaId,
  detalharTaxaIngresso,
  formatBrl,
  formatPercentual,
  parseValorMonetarioInput,
  precoVendaSugerido,
} from "@/lib/tarifas-plataforma";

const cell =
  "min-w-0 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900";

type Props = {
  loteIndex?: number;
  loteLabel?: string;
  onAplicarPreco?: (preco: number, loteIndex: number) => void;
  className?: string;
};

export function IngressoPrecoCalculadora({
  loteIndex = 0,
  loteLabel = "1º lote",
  onAplicarPreco,
  className = "",
}: Props) {
  const [liquidoInput, setLiquidoInput] = useState("");
  const [planoId, setPlanoId] = useState<PlanoTarifaId>("padrao");

  const tarifa = planoId === "assinatura" ? TARIFA_ASSINATURA : TARIFA_PADRAO;

  const liquido = useMemo(() => parseValorMonetarioInput(liquidoInput), [liquidoInput]);

  const precoSugerido = useMemo(() => {
    if (liquido == null || liquido < 0) return null;
    const p = precoVendaSugerido(liquido, tarifa);
    if (p == null) return null;
    return Math.ceil(p * 100) / 100;
  }, [liquido, tarifa]);

  const detalhe = useMemo(() => {
    if (precoSugerido == null) return null;
    return detalharTaxaIngresso(precoSugerido, tarifa);
  }, [precoSugerido, tarifa]);

  return (
    <div
      className={`rounded-xl border border-emerald-200 bg-gradient-to-b from-emerald-50/90 to-white p-4 ring-1 ring-emerald-200/70 ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-zinc-900">Calculadora de preço</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-600">
            Informe quanto quer receber por ingresso (líquido). A taxa da plataforma é descontada do
            valor de venda — o comprador paga o preço sugerido.
          </p>
        </div>
        <Link
          href="/planos"
          className="shrink-0 text-xs font-medium text-emerald-800 underline-offset-2 hover:underline"
        >
          Ver planos
        </Link>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-2 text-xs font-medium text-zinc-800 sm:col-span-2">
          Quanto você quer ganhar (por ingresso)
          <InputValorBrl
            value={liquidoInput}
            onChange={setLiquidoInput}
            placeholder="45,00"
            aria-describedby="calc-taxa-plataforma"
          />
        </label>

        <fieldset className="grid gap-2 sm:col-span-2" id="calc-taxa-plataforma">
          <legend className="text-xs font-medium text-zinc-800">Taxa da plataforma</legend>
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-zinc-200 bg-white/80 px-3 py-2 text-xs text-zinc-700">
            <input
              type="radio"
              name="plano-tarifa-calc"
              checked={planoId === "padrao"}
              onChange={() => setPlanoId("padrao")}
              className="mt-0.5 text-emerald-700"
            />
            <span>
              <span className="font-semibold text-zinc-900">{formatPercentual(TARIFA_PADRAO.percentual)}</span>
              {" + "}
              <span className="font-semibold text-zinc-900">{formatBrl(TARIFA_PADRAO.fixoPorIngresso)}</span>
              {" por ingresso vendido"}
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-zinc-200 bg-white/80 px-3 py-2 text-xs text-zinc-700">
            <input
              type="radio"
              name="plano-tarifa-calc"
              checked={planoId === "assinatura"}
              onChange={() => setPlanoId("assinatura")}
              className="mt-0.5 text-emerald-700"
            />
            <span>
              <span className="font-semibold text-zinc-900">{formatPercentual(TARIFA_ASSINATURA.percentual)}</span>
              {" + "}
              <span className="font-semibold text-zinc-900">{formatBrl(TARIFA_ASSINATURA.fixoPorIngresso)}</span>
              {" por ingresso (plano com assinatura)"}
            </span>
          </label>
        </fieldset>
      </div>

      {detalhe && liquido != null ? (
        <div className="mt-4 space-y-3 rounded-lg border border-emerald-100 bg-white/90 p-3 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-800">Resultado</p>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-zinc-600">Preço sugerido para venda</span>
            <span className="text-xl font-bold text-zinc-900">{formatBrl(detalhe.precoVenda)}</span>
          </div>
          <ul className="space-y-1.5 border-t border-zinc-100 pt-3 text-xs text-zinc-600">
            <li className="flex justify-between gap-2">
              <span>Taxa percentual ({formatPercentual(tarifa.percentual)})</span>
              <span className="font-medium text-zinc-800">{formatBrl(detalhe.taxaPercentualValor)}</span>
            </li>
            <li className="flex justify-between gap-2">
              <span>Taxa fixa por ingresso</span>
              <span className="font-medium text-zinc-800">{formatBrl(detalhe.taxaFixa)}</span>
            </li>
            <li className="flex justify-between gap-2 border-t border-dashed border-zinc-200 pt-1.5">
              <span className="font-medium text-zinc-700">Total de taxas</span>
              <span className="font-semibold text-zinc-900">{formatBrl(detalhe.taxaTotal)}</span>
            </li>
            <li className="flex justify-between gap-2">
              <span>Você recebe (líquido)</span>
              <span className="font-semibold text-emerald-800">{formatBrl(detalhe.liquidoOrganizador)}</span>
            </li>
          </ul>
          {onAplicarPreco ? (
            <button
              type="button"
              className="btn-success mt-2 w-full text-sm"
              onClick={() => onAplicarPreco(detalhe.precoVenda, loteIndex)}
            >
              Usar {formatBrl(detalhe.precoVenda)} no {loteLabel}
            </button>
          ) : null}
        </div>
      ) : liquidoInput.trim() ? (
        <p className="mt-3 text-xs text-amber-800">Informe um valor válido (ex.: 45 ou 45,90).</p>
      ) : null}

      <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
        Valores ilustrativos da EventosBR; tarifas de cartão/PIX do provedor de pagamento não estão
        incluídas. A mensalidade da assinatura é cobrada à parte.
      </p>
    </div>
  );
}
