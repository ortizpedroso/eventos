"use client";

import { useMemo, useState } from "react";

import { InputValorBrl } from "@/components/input-valor-brl";
import { moedaBrlFromNumber } from "@/lib/moeda-brl";
import { formatBrl, parseValorMonetarioInput } from "@/lib/tarifas-plataforma";
import {
  AVISO_LEGAL_TAXAS,
  INGRESSO_MINIMO_PAGO_REAIS,
  cotacaoCheckout,
} from "@/lib/taxas-asaas-publicas";

const PARCELAS_OPCOES = [1, 2, 3, 6, 12] as const;

const cell =
  "min-w-0 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900";

/** Simulador do comprador (spec §4 P4): quanto pago por parcela e no total. */
export function PlanosSimuladorComprador() {
  const [valorStr, setValorStr] = useState(() => moedaBrlFromNumber(80));
  const [parcelas, setParcelas] = useState<number>(3);

  const valor = parseValorMonetarioInput(valorStr) ?? 0;

  const cotacoes = useMemo(() => {
    if (valor < INGRESSO_MINIMO_PAGO_REAIS) return null;
    return PARCELAS_OPCOES.map((n) => ({ parcelas: n, cotacao: cotacaoCheckout(valor, n) }));
  }, [valor]);

  const selecionada = cotacoes?.find((c) => c.parcelas === parcelas) ?? cotacoes?.[0] ?? null;

  return (
    <section
      className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6"
      data-testid="planos-simulador-comprador"
    >
      <h2 className="text-lg font-semibold text-zinc-900">Simulador do comprador</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Veja quanto você paga por ingresso: PIX sem acréscimo; no cartão parcelado o acréscimo aparece explícito antes
        de pagar.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-zinc-600">Preço do ingresso</span>
          <InputValorBrl className={`mt-1 w-full ${cell}`} value={valorStr} onChange={setValorStr} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-zinc-600">Parcelas no cartão</span>
          <select
            className={`mt-1 w-full ${cell}`}
            value={parcelas}
            onChange={(e) => setParcelas(Number(e.target.value))}
          >
            {PARCELAS_OPCOES.map((n) => (
              <option key={n} value={n}>
                {n === 1 ? "À vista (1x)" : `${n}x`}
              </option>
            ))}
          </select>
        </label>
      </div>

      {valor > 0 && valor < INGRESSO_MINIMO_PAGO_REAIS ? (
        <p className="mt-4 text-sm text-amber-800">
          Ingressos pagos começam em {formatBrl(INGRESSO_MINIMO_PAGO_REAIS)}.
        </p>
      ) : null}

      {selecionada ? (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
          <ul className="space-y-1 text-sm text-zinc-800">
            <li className="flex justify-between gap-2">
              <span>PIX (sem acréscimo)</span>
              <strong>{formatBrl(valor)}</strong>
            </li>
            <li className="flex justify-between gap-2">
              <span>
                Cartão {selecionada.parcelas === 1 ? "à vista" : `${selecionada.parcelas}x`}
                {selecionada.cotacao.acrescimoParcelamento > 0
                  ? ` (+${formatBrl(selecionada.cotacao.acrescimoParcelamento)})`
                  : ""}
              </span>
              <strong>{formatBrl(selecionada.cotacao.totalPagar)}</strong>
            </li>
            {selecionada.cotacao.valorParcela ? (
              <li className="flex justify-between gap-2 text-emerald-900">
                <span>Valor por parcela</span>
                <strong>
                  {selecionada.parcelas}x de {formatBrl(selecionada.cotacao.valorParcela)}
                </strong>
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      <p className="mt-3 text-[11px] text-zinc-500">{AVISO_LEGAL_TAXAS}</p>
    </section>
  );
}
