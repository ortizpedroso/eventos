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
        destaque
          ? "border-emerald-600 bg-white ring-1 ring-emerald-600"
          : "border-zinc-200 bg-white"
      }`}
    >
      <p
        className={`text-xs font-semibold uppercase tracking-wide ${
          destaque ? "text-emerald-800" : "text-zinc-500"
        }`}
      >
        {titulo}
      </p>
      <p className="mt-1 text-sm text-zinc-600">{subtitulo}</p>

      <ul className="mt-4 space-y-2 border-t border-zinc-100 pt-4 text-xs text-zinc-600">
        <li className="flex justify-between gap-2">
          <span>Arrecadação ({sim.quantidade.toLocaleString("pt-BR")} × {formatBrl(sim.precoIngresso)})</span>
          <span className="font-medium text-zinc-800">{formatBrl(sim.arrecadacao)}</span>
        </li>
        {c.mensalidade > 0 ? (
          <li className="flex justify-between gap-2">
            <span>Mensalidade</span>
            <span className="font-medium text-zinc-800">{formatBrl(c.mensalidade)}</span>
          </li>
        ) : null}
        <li className="flex justify-between gap-2">
          <span>Taxa {pctLabel} sobre arrecadação</span>
          <span className="font-medium text-zinc-800">{formatBrl(c.taxaPercentualValor)}</span>
        </li>
        <li className="flex justify-between gap-2">
          <span>{formatBrl(fixoUnit)} × {sim.quantidade.toLocaleString("pt-BR")} ingressos</span>
          <span className="font-medium text-zinc-800">{formatBrl(c.taxaFixaTotal)}</span>
        </li>
        <li className="flex justify-between gap-2 border-t border-dashed border-zinc-200 pt-2">
          <span className="font-medium text-zinc-700">Total em taxas{c.mensalidade > 0 ? " + mensalidade" : ""}</span>
          <span className="font-semibold text-zinc-900">{formatBrl(c.taxaTotal)}</span>
        </li>
      </ul>

      <p className={`mt-4 text-lg font-bold ${destaque ? "text-emerald-900" : "text-zinc-900"}`}>
        Você lucra: {formatBrl(c.liquido)}
      </p>
      <p className="mt-1 text-xs text-zinc-500">Estimativa líquida após taxas da plataforma.</p>
    </div>
  );
}

export function PlanosSimuladorLucro() {
  const [precoInput, setPrecoInput] = useState("50");
  const [qtdInput, setQtdInput] = useState("1000");

  const sim = useMemo(() => {
    const preco = parseValorMonetarioInput(precoInput);
    const qtd = parseQuantidadeInput(qtdInput);
    if (preco == null || qtd == null) return null;
    return simularLucroPlanos(preco, qtd);
  }, [precoInput, qtdInput]);

  const inputsValidos = precoInput.trim() !== "" && qtdInput.trim() !== "";

  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-6 shadow-sm sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Simulador</p>
      <h2 className="mt-2 text-xl font-semibold text-zinc-900 sm:text-2xl">
        Quanto você lucra com suas vendas?
      </h2>
      <p className="mt-3 text-sm leading-6 text-zinc-600">
        Informe o preço de venda do ingresso e quantos ingressos pretende vender no período (ex.: um
        mês). Compare o lucro líquido <strong className="text-zinc-800">sem assinatura</strong> e{" "}
        <strong className="text-zinc-800">com assinatura</strong>, usando as taxas divulgadas abaixo.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium text-zinc-800">
          Valor do ingresso (preço de venda)
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
              R$
            </span>
            <input
              className={`${cell} pl-9`}
              inputMode="decimal"
              value={precoInput}
              onChange={(e) => setPrecoInput(e.target.value)}
              placeholder="50,00"
            />
          </div>
        </label>
        <label className="grid gap-1 text-sm font-medium text-zinc-800">
          Quantidade de ingressos vendidos
          <input
            className={cell}
            inputMode="numeric"
            value={qtdInput}
            onChange={(e) => setQtdInput(e.target.value.replace(/\D/g, ""))}
            placeholder="1000"
          />
        </label>
      </div>

      {sim ? (
        <>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <CenarioCard
              titulo="Sem assinatura"
              subtitulo={`${formatPercentual(TARIFA_PADRAO.percentual)} + ${formatBrl(TARIFA_PADRAO.fixoPorIngresso)} por ingresso`}
              sim={sim}
              tipo="padrao"
              destaque={!sim.assinaturaValeMais}
            />
            <CenarioCard
              titulo="Com assinatura"
              subtitulo={`${formatBrl(sim.assinatura.mensalidade)}/mês + ${formatPercentual(TARIFA_ASSINATURA.percentual)} + ${formatBrl(TARIFA_ASSINATURA.fixoPorIngresso)} por ingresso`}
              sim={sim}
              tipo="assinatura"
              destaque={sim.assinaturaValeMais}
            />
          </div>

          <p
            className={`mt-6 rounded-lg px-4 py-3 text-sm font-medium ring-1 ${
              sim.assinaturaValeMais
                ? "bg-emerald-50/90 text-emerald-950 ring-emerald-200/80"
                : "bg-zinc-100 text-zinc-800 ring-zinc-200"
            }`}
          >
            {sim.assinaturaValeMais ? (
              <>
                Com assinatura, neste cenário você fica com cerca de{" "}
                <span className="whitespace-nowrap">{formatBrl(sim.diferencaLiquido)} a mais</span> do
                que no plano por uso — antes de impostos e tarifas do meio de pagamento.
              </>
            ) : (
              <>
                Sem assinatura, neste cenário você fica com{" "}
                <span className="whitespace-nowrap">{formatBrl(-sim.diferencaLiquido)} a mais</span> do
                que pagando a mensalidade — a assinatura só compensa com volume maior de vendas.
              </>
            )}
          </p>
        </>
      ) : inputsValidos ? (
        <p className="mt-4 text-sm text-amber-800">
          Verifique os valores: preço maior que zero e quantidade inteira de ingressos.
        </p>
      ) : null}

      <p className="mt-4 text-[11px] leading-relaxed text-zinc-500">
        Simulação ilustrativa EventosBR; não inclui tarifas de cartão/PIX do provedor nem impostos. A
        mensalidade da assinatura refere-se ao período considerado na simulação (ex.: um mês de vendas).
      </p>
    </div>
  );
}
