"use client";

import { useMemo, useState } from "react";

import {
  TARIFA_ASSINATURA,
  TARIFA_PADRAO,
  formatBrl,
  formatPercentual,
  parseQuantidadeInput,
  parseValorMonetarioInput,
  simularLucroPlanos,
} from "@/lib/tarifas-plataforma";
import { AVISO_LEGAL_TAXAS, SYMPLA_FONTE_URL, comparativoSympla } from "@/lib/taxas-asaas-publicas";

const cell =
  "min-w-0 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900";

function CenarioCard({
  titulo,
  subtitulo,
  destaque,
  sim,
  tipo,
}: {
  titulo: string;
  subtitulo: string;
  destaque?: boolean;
  sim: NonNullable<ReturnType<typeof simularLucroPlanos>>;
  tipo: "padrao" | "assinatura";
}) {
  const c = tipo === "padrao" ? sim.padrao : sim.assinatura;
  const pctLabel =
    tipo === "padrao" ? formatPercentual(TARIFA_PADRAO.percentual) : formatPercentual(TARIFA_ASSINATURA.percentual);
  const fixoUnit =
    tipo === "padrao" ? TARIFA_PADRAO.fixoPorIngresso : TARIFA_ASSINATURA.fixoPorIngresso;

  return (
    <div
      className={`rounded-xl border p-5 shadow-sm ${
        destaque ? "border-emerald-600 bg-white ring-1 ring-emerald-600" : "border-zinc-200 bg-white"
      }`}
    >
      <p className={`text-xs font-semibold uppercase tracking-wide ${destaque ? "text-emerald-800" : "text-zinc-500"}`}>
        {titulo}
      </p>
      <p className="mt-1 text-sm text-zinc-600">{subtitulo}</p>
      <p className={`mt-4 text-lg font-bold ${destaque ? "text-emerald-900" : "text-zinc-900"}`}>
        Você lucra: {formatBrl(c.liquido)}
      </p>
      <p className="mt-2 text-xs text-zinc-500">
        Taxa {pctLabel} + {formatBrl(fixoUnit)}/ingresso — total taxas {formatBrl(c.taxaTotal)}
      </p>
    </div>
  );
}

export function PlanosSimuladorLucro() {
  const [precoInput, setPrecoInput] = useState("49.90");
  const [qtdInput, setQtdInput] = useState("500");

  const preco = useMemo(() => parseValorMonetarioInput(precoInput), [precoInput]);
  const qtd = useMemo(() => parseQuantidadeInput(qtdInput), [qtdInput]);
  const sim = useMemo(() => (preco && qtd ? simularLucroPlanos(preco, qtd) : null), [preco, qtd]);
  const sympla = preco ? comparativoSympla(preco * (qtd ?? 1)) : null;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-xl font-semibold text-zinc-900">Simulador de lucro</h2>
      <p className="mt-2 text-sm text-zinc-600">Estime quanto sobra após as taxas EventosBR.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-zinc-700">Preço do ingresso (R$)</span>
          <input className={`${cell} mt-1`} value={precoInput} onChange={(e) => setPrecoInput(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-zinc-700">Quantidade vendida</span>
          <input className={`${cell} mt-1`} value={qtdInput} onChange={(e) => setQtdInput(e.target.value.replace(/\D/g, ""))} />
        </label>
      </div>

      {sim ? (
        <>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <CenarioCard
              titulo="EventosBR — sem assinatura"
              subtitulo={`${formatPercentual(TARIFA_PADRAO.percentual)} + ${formatBrl(TARIFA_PADRAO.fixoPorIngresso)}/ingresso`}
              sim={sim}
              tipo="padrao"
              destaque={!sim.assinaturaValeMais}
            />
            <CenarioCard
              titulo="EventosBR — com assinatura"
              subtitulo="Taxa reduzida + mensalidade"
              sim={sim}
              tipo="assinatura"
              destaque={sim.assinaturaValeMais}
            />
          </div>

          {sympla ? (
            <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-950">
              <p className="font-semibold">Comparativo ilustrativo — Sympla</p>
              <p className="mt-1">
                Taxa estimada Sympla (~12%): {formatBrl(sympla.taxaEstimada)} · Líquido estimado:{" "}
                {formatBrl(sympla.liquidoEstimado)}
              </p>
              <p className="mt-2 text-xs text-amber-900/80">{sympla.disclaimer}</p>
              <a href={SYMPLA_FONTE_URL} className="mt-1 inline-block text-xs text-amber-900 underline" target="_blank" rel="noopener noreferrer">
                Conferir no site oficial
              </a>
            </div>
          ) : null}
        </>
      ) : null}

      <p className="mt-4 text-[11px] leading-relaxed text-zinc-500">{AVISO_LEGAL_TAXAS}</p>
    </div>
  );
}
