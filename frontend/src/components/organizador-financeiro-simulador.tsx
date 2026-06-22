"use client";

import { useMemo, useState } from "react";

import { InputValorBrl } from "@/components/input-valor-brl";
import {
  TARIFA_ASSINATURA,
  TARIFA_PADRAO,
  type PlanoTarifaId,
  detalharTaxaIngresso,
  formatBrl,
  parseQuantidadeInput,
  parseValorMonetarioInput,
} from "@/lib/tarifas-plataforma";
import { AVISO_LEGAL_TAXAS, calcularAcrescimoParcelamento } from "@/lib/taxas-asaas-publicas";
import { moedaBrlFromNumber } from "@/lib/moeda-brl";

type Props = {
  planoTarifa?: PlanoTarifaId;
};

export function OrganizadorFinanceiroSimulador({ planoTarifa = "padrao" }: Props) {
  const [preco, setPreco] = useState(() => moedaBrlFromNumber(50));
  const [quantidade, setQuantidade] = useState("100");
  const [parcelas, setParcelas] = useState(3);

  const tarifa = planoTarifa === "assinatura" ? TARIFA_ASSINATURA : TARIFA_PADRAO;
  const precoNum = parseValorMonetarioInput(preco) ?? 0;
  const qtd = parseQuantidadeInput(quantidade) ?? 0;

  const sim = useMemo(() => {
    if (precoNum < 10 || qtd < 1) return null;
    const det = detalharTaxaIngresso(precoNum, tarifa);
    if (!det) return null;
    const acrescimo = calcularAcrescimoParcelamento(precoNum, parcelas);
    const liquidoRepasse = det.liquidoOrganizador;
    const liquidoAbsorvendo = Math.max(0, liquidoRepasse - acrescimo);
    return {
      bruto: round2(precoNum * qtd),
      taxa: round2(det.taxaTotal * qtd),
      liquido: round2(liquidoRepasse * qtd),
      liquidoAbsorvendo: round2(liquidoAbsorvendo * qtd),
      acrescimoUnit: acrescimo,
    };
  }, [precoNum, qtd, tarifa, parcelas]);

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-900">Simulador de receita</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Estimativa com seu plano atual ({planoTarifa === "assinatura" ? "assinatura" : "padrão"}). Repasse automático
        por venda.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <label className="text-xs text-zinc-600">Preço do ingresso</label>
          <InputValorBrl value={preco} onChange={setPreco} className="mt-1 rounded-lg" />
        </div>
        <div>
          <label className="text-xs text-zinc-600">Quantidade vendida</label>
          <input
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-600">Parcelas (ref. absorver)</label>
          <select
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            value={parcelas}
            onChange={(e) => setParcelas(Number(e.target.value))}
          >
            {[1, 2, 3, 6, 12].map((n) => (
              <option key={n} value={n}>
                {n}x
              </option>
            ))}
          </select>
        </div>
      </div>
      {sim ? (
        <ul className="mt-4 space-y-1.5 text-sm text-zinc-700">
          <li className="flex justify-between gap-2">
            <span>Receita bruta</span>
            <span className="font-medium">{formatBrl(sim.bruto)}</span>
          </li>
          <li className="flex justify-between gap-2 text-amber-900">
            <span>Taxa EventosBR</span>
            <span>− {formatBrl(sim.taxa)}</span>
          </li>
          <li className="flex justify-between gap-2 font-semibold text-emerald-800">
            <span>Você recebe (repassar parcelamento)</span>
            <span>{formatBrl(sim.liquido)}</span>
          </li>
          {sim.acrescimoUnit > 0 ? (
            <li className="flex justify-between gap-2 text-amber-900">
              <span>Se absorver {parcelas}x (−{formatBrl(sim.acrescimoUnit)}/ingresso)</span>
              <span>{formatBrl(sim.liquidoAbsorvendo)}</span>
            </li>
          ) : null}
        </ul>
      ) : (
        <p className="mt-4 text-xs text-amber-800">Informe preço ≥ R$ 10 e quantidade ≥ 1.</p>
      )}
      <p className="mt-3 text-[11px] text-zinc-500">{AVISO_LEGAL_TAXAS}</p>
    </section>
  );
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
