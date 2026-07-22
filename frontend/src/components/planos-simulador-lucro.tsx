"use client";

import { useMemo, useState } from "react";

import { InputValorBrl } from "@/components/input-valor-brl";
import {
  MENSALIDADE_ASSINATURA_MENSAL,
  TARIFA_ASSINATURA,
  TARIFA_PADRAO,
  type PlanoTarifa,
  type SimulacaoCenarioPlanos,
  analisarRecomendacaoPlano,
  formatBrl,
  formatPercentual,
  parseQuantidadeInput,
  parseValorMonetarioInput,
  simularLucroPlanos,
} from "@/lib/tarifas-plataforma";
import { moedaBrlFromNumber } from "@/lib/moeda-brl";
import { AVISO_LEGAL_TAXAS } from "@/lib/taxas-asaas-publicas";

const cell =
  "min-w-0 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900";

function BreakdownPlano({
  titulo,
  subtitulo,
  tarifa,
  quantidade,
  arrecadacao,
  cenario,
  destaque,
}: {
  titulo: string;
  subtitulo: string;
  tarifa: PlanoTarifa;
  quantidade: number;
  arrecadacao: number;
  cenario: SimulacaoCenarioPlanos;
  destaque?: boolean;
}) {
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

      <ul className="mt-4 space-y-1.5 text-sm text-zinc-700">
        <li className="flex justify-between gap-2">
          <span>Receita bruta</span>
          <span className="font-medium">{formatBrl(arrecadacao)}</span>
        </li>
        <li className="flex justify-between gap-2 text-amber-900">
          <span>Taxa {formatPercentual(tarifa.percentual)} do valor</span>
          <span>− {formatBrl(cenario.taxaPercentualValor)}</span>
        </li>
        <li className="flex justify-between gap-2 text-amber-900">
          <span>
            Taxa fixa {formatBrl(tarifa.fixoPorIngresso)} por ingresso × {quantidade}
          </span>
          <span>− {formatBrl(cenario.taxaFixaTotal)}</span>
        </li>
        {cenario.mensalidade > 0 ? (
          <li className="flex justify-between gap-2 text-amber-900">
            <span>Mensalidade da assinatura</span>
            <span>− {formatBrl(cenario.mensalidade)}</span>
          </li>
        ) : null}
        <li className="flex justify-between gap-2 border-t border-zinc-100 pt-1.5 text-xs text-zinc-500">
          <span>Total de taxas</span>
          <span>− {formatBrl(cenario.taxaTotal)}</span>
        </li>
        <li className="flex justify-between gap-2 font-semibold text-emerald-800">
          <span>Valor líquido a receber</span>
          <span>{formatBrl(cenario.liquido)}</span>
        </li>
      </ul>
    </div>
  );
}

export function PlanosSimuladorLucro() {
  const [precoInput, setPrecoInput] = useState(() => moedaBrlFromNumber(49.9));
  const [qtdInput, setQtdInput] = useState("500");

  const preco = useMemo(() => parseValorMonetarioInput(precoInput), [precoInput]);
  const qtd = useMemo(() => parseQuantidadeInput(qtdInput), [qtdInput]);
  const sim = useMemo(() => (preco && qtd ? simularLucroPlanos(preco, qtd) : null), [preco, qtd]);
  const analise = useMemo(() => (sim ? analisarRecomendacaoPlano(sim) : null), [sim]);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-xl font-semibold text-zinc-900">Simulador de receita</h2>
      <p className="mt-2 text-sm text-zinc-600">
        Estime quanto você recebe em cada plano, com todas as taxas discriminadas. A taxa EventosBR é fixa por
        ingresso — não muda com PIX ou cartão.
      </p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-zinc-700">Preço do ingresso</span>
          <InputValorBrl value={precoInput} onChange={setPrecoInput} />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-zinc-700">Quantidade vendida</span>
          <input className={cell} value={qtdInput} onChange={(e) => setQtdInput(e.target.value.replace(/\D/g, ""))} />
        </label>
      </div>

      {sim && analise ? (
        <>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <BreakdownPlano
              titulo="Sem assinatura"
              subtitulo={`${formatPercentual(TARIFA_PADRAO.percentual)} + ${formatBrl(TARIFA_PADRAO.fixoPorIngresso)}/ingresso · sem mensalidade`}
              tarifa={TARIFA_PADRAO}
              quantidade={sim.quantidade}
              arrecadacao={sim.arrecadacao}
              cenario={sim.padrao}
              destaque={analise.recomendado === "padrao"}
            />
            <BreakdownPlano
              titulo="Com assinatura"
              subtitulo={`${formatPercentual(TARIFA_ASSINATURA.percentual)} + ${formatBrl(TARIFA_ASSINATURA.fixoPorIngresso)}/ingresso + ${formatBrl(MENSALIDADE_ASSINATURA_MENSAL)}/mês`}
              tarifa={TARIFA_ASSINATURA}
              quantidade={sim.quantidade}
              arrecadacao={sim.arrecadacao}
              cenario={sim.assinatura}
              destaque={analise.recomendado === "assinatura"}
            />
          </div>

          <div
            className={`mt-6 rounded-xl border p-5 ${
              analise.recomendado === "assinatura"
                ? "border-emerald-200 bg-emerald-50/80"
                : "border-sky-200 bg-sky-50/80"
            }`}
          >
            <p
              className={`text-sm font-semibold ${
                analise.recomendado === "assinatura" ? "text-emerald-900" : "text-sky-950"
              }`}
            >
              {analise.titulo}
            </p>
            {analise.paragrafos.map((p) => (
              <p key={p} className="mt-2 text-sm leading-relaxed text-zinc-700">
                {p}
              </p>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-6 text-sm text-amber-800">Informe preço e quantidade válidos para simular.</p>
      )}

      <p className="mt-4 text-[11px] leading-relaxed text-zinc-500">{AVISO_LEGAL_TAXAS}</p>
    </div>
  );
}
