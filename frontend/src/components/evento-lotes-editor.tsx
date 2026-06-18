"use client";

import { useRef } from "react";

import { IngressoPrecoCalculadora } from "@/components/ingresso-preco-calculadora";
import { InputValorBrl } from "@/components/input-valor-brl";
import { isoToDatetimeLocalValue } from "@/lib/eventos";
import { moedaBrlFromNumber } from "@/lib/moeda-brl";
import { parseValorMonetarioInput } from "@/lib/tarifas-plataforma";
import type { Evento, IngressoTipo } from "@/lib/types";

export const TIPOS_LOTE: { value: IngressoTipo; label: string }[] = [
  { value: "inteira", label: "Inteira" },
  { value: "meia", label: "Meia-entrada" },
  { value: "vip", label: "VIP" },
  { value: "cortesia", label: "Cortesia (grátis)" },
];

export type LoteFormRow = {
  id?: string;
  nome: string;
  tipo: IngressoTipo;
  preco: string;
  ordem: number;
  quantidade_maxima: string;
  ativo: boolean;
  vendas_inicio: string;
  vendas_fim: string;
};

export function defaultLoteRows(precoInicial?: string): LoteFormRow[] {
  const preco = precoInicial ?? moedaBrlFromNumber(49.9);
  return [
    {
      nome: "1º lote",
      tipo: "inteira",
      preco,
      ordem: 1,
      quantidade_maxima: "",
      ativo: true,
      vendas_inicio: "",
      vendas_fim: "",
    },
  ];
}

export function eventoLotesToRows(ev: Evento): LoteFormRow[] {
  const lotes = ev.ingresso_lotes;
  if (lotes?.length) {
    return [...lotes]
      .sort((a, b) => a.ordem - b.ordem || a.id.localeCompare(b.id))
      .map((l) => ({
        id: l.id,
        nome: l.nome,
        tipo: (l.tipo as IngressoTipo) || "inteira",
        preco: moedaBrlFromNumber(l.preco),
        ordem: l.ordem,
        quantidade_maxima: l.quantidade_maxima != null ? String(l.quantidade_maxima) : "",
        ativo: l.ativo,
        vendas_inicio: l.vendas_inicio ? isoToDatetimeLocalValue(l.vendas_inicio) : "",
        vendas_fim: l.vendas_fim ? isoToDatetimeLocalValue(l.vendas_fim) : "",
      }));
  }
  return defaultLoteRows(moedaBrlFromNumber(ev.preco_ingresso ?? 49.9));
}

export type IngressoLotePayload = {
  id?: string;
  nome: string;
  tipo: IngressoTipo;
  preco: number;
  ordem: number;
  quantidade_maxima: number | null;
  ativo: boolean;
  vendas_inicio: string | null;
  vendas_fim: string | null;
};

/** Converte linhas do formulário para o JSON da API (datas ISO ou null). */
export function lotesRowsToApiPayload(rows: LoteFormRow[]): IngressoLotePayload[] {
  return rows.map((r, idx) => {
    const preco = parseValorMonetarioInput(r.preco) ?? NaN;
    const q = r.quantidade_maxima.trim();
    const ordem = Number.isFinite(r.ordem) ? r.ordem : idx + 1;
    const vi = r.vendas_inicio.trim();
    const vf = r.vendas_fim.trim();
    const base: IngressoLotePayload = {
      nome: r.nome.trim() || `Lote ${idx + 1}`,
      tipo: r.tipo,
      preco: r.tipo === "cortesia" ? 0 : preco,
      ordem,
      quantidade_maxima: q ? Number.parseInt(q, 10) : null,
      ativo: r.ativo,
      vendas_inicio: vi ? new Date(vi).toISOString() : null,
      vendas_fim: vf ? new Date(vf).toISOString() : null,
    };
    if (r.id) {
      return { ...base, id: r.id };
    }
    return base;
  });
}

export function precoMinimoDosLotes(rows: LoteFormRow[]): number {
  let m = Infinity;
  for (const r of rows) {
    if (r.tipo === "cortesia") continue;
    const p = parseValorMonetarioInput(r.preco);
    if (p != null && p < m) m = p;
  }
  return m === Infinity ? 0 : m;
}

const cell =
  "min-w-0 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900";

type Props = {
  rows: LoteFormRow[];
  onChange: (rows: LoteFormRow[]) => void;
  /** Classes do contentor (ex.: borda do painel novo evento). */
  className?: string;
  /** Exibe calculadora de preço (quanto ganhar → taxa → preço sugerido). */
  showCalculadora?: boolean;
};

function loteGratuitoPadrao(nome = "Ingresso gratuito"): LoteFormRow {
  return {
    nome,
    tipo: "cortesia",
    preco: moedaBrlFromNumber(0),
    ordem: 1,
    quantidade_maxima: "",
    ativo: true,
    vendas_inicio: "",
    vendas_fim: "",
  };
}

export function EventoLotesEditor({ rows, onChange, className = "", showCalculadora = true }: Props) {
  const lotesPagosBackup = useRef<LoteFormRow[] | null>(null);

  const ativos = rows.filter((r) => r.ativo);
  const eventoGratuito =
    ativos.length > 0 && ativos.every((r) => r.tipo === "cortesia");

  function setEventoGratuito(gratuito: boolean) {
    if (gratuito) {
      lotesPagosBackup.current = rows.map((r) => ({ ...r }));
      onChange([loteGratuitoPadrao(rows[0]?.nome?.trim() || "Ingresso gratuito")]);
      return;
    }
    const restaurar = lotesPagosBackup.current;
    lotesPagosBackup.current = null;
    onChange(restaurar?.length ? restaurar : defaultLoteRows());
  }

  function setRow(i: number, patch: Partial<LoteFormRow>) {
    const next = rows.map((r, j) => (j === i ? { ...r, ...patch } : r));
    onChange(next);
  }

  function addRow() {
    const nextOrd = Math.max(0, ...rows.map((r) => r.ordem)) + 1;
    onChange([
      ...rows,
      {
        nome: `${nextOrd}º lote`,
        tipo: "inteira",
        preco: "",
        ordem: nextOrd,
        quantidade_maxima: "",
        ativo: true,
        vendas_inicio: "",
        vendas_fim: "",
      },
    ]);
  }

  function removeRow(i: number) {
    if (rows.length <= 1) return;
    onChange(rows.filter((_, j) => j !== i));
  }

  function aplicarPrecoCalculadora(preco: number, loteIndex: number) {
    const idx = Math.min(Math.max(0, loteIndex), rows.length - 1);
    setRow(idx, { preco: moedaBrlFromNumber(preco) });
  }

  const primeiroLoteNome = rows[0]?.nome?.trim() || "1º lote";

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="rounded-lg border border-emerald-200 bg-emerald-50/90 p-3 shadow-sm">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={eventoGratuito}
            onChange={(e) => setEventoGratuito(e.target.checked)}
            className="mt-0.5 rounded border-emerald-400 text-emerald-700 focus:ring-emerald-600"
          />
          <span className="text-sm text-emerald-950">
            <strong className="font-semibold">Evento gratuito</strong>
            <span className="mt-0.5 block text-xs leading-relaxed text-emerald-900/90">
              Participantes não pagam ingresso (cortesia). No checkout é pedido quem autorizou a
              cortesia — só para seu controle interno. Você também pode usar o tipo{" "}
              <em>Cortesia (grátis)</em> em um lote específico, junto com lotes pagos.
            </span>
          </span>
        </label>
      </div>

      {showCalculadora && !eventoGratuito ? (
        <IngressoPrecoCalculadora
          loteIndex={0}
          loteLabel={primeiroLoteNome}
          onAplicarPreco={aplicarPrecoCalculadora}
        />
      ) : null}

      <div>
        <p className="text-sm font-medium text-zinc-900">Lotes de ingresso</p>
        <p className="mt-1 text-xs leading-relaxed text-zinc-600">
          A venda pública usa o <strong className="text-zinc-800">primeiro lote ativo</strong> por ordem com
          vagas e dentro das datas (se definir). Quando um lote esgota ou fecha, passa ao seguinte. Para
          evento 100% grátis, marque a opção acima; para só alguns ingressos grátis, escolha{" "}
          <strong className="text-zinc-800">Cortesia (grátis)</strong> no campo Tipo.
        </p>
      </div>

      <div className="space-y-4">
        {rows.map((row, i) => (
          <div
            key={row.id ?? `new-${i}`}
            className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 shadow-sm"
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-zinc-500">Lote {i + 1}</span>
              {rows.length > 1 ? (
                <button
                  type="button"
                  className="text-xs font-medium text-red-700 hover:underline"
                  onClick={() => removeRow(i)}
                >
                  Remover
                </button>
              ) : null}
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <label className="grid gap-0.5 text-xs font-medium text-zinc-700 sm:col-span-2">
                Nome
                <input
                  className={cell}
                  value={row.nome}
                  onChange={(e) => setRow(i, { nome: e.target.value })}
                  placeholder="Ex.: 1º lote promocional"
                />
              </label>
              <label className="grid gap-0.5 text-xs font-medium text-zinc-700">
                Tipo
                <select
                  className={cell}
                  value={row.tipo}
                  onChange={(e) => {
                    const tipo = e.target.value as IngressoTipo;
                    const patch: Partial<LoteFormRow> = { tipo };
                    if (tipo === "cortesia") patch.preco = moedaBrlFromNumber(0);
                    setRow(i, patch);
                  }}
                >
                  {TIPOS_LOTE.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-xs font-medium text-zinc-700">
                Preço
                <InputValorBrl
                  value={row.preco}
                  disabled={row.tipo === "cortesia"}
                  placeholder={row.tipo === "cortesia" ? "0,00" : "49,90"}
                  onChange={(masked) => setRow(i, { preco: masked })}
                />
              </label>
              <label className="grid gap-0.5 text-xs font-medium text-zinc-700">
                Ordem
                <input
                  className={cell}
                  type="number"
                  min={1}
                  max={999}
                  value={row.ordem}
                  onChange={(e) => setRow(i, { ordem: Number.parseInt(e.target.value, 10) || 1 })}
                />
              </label>
              <label className="grid gap-0.5 text-xs font-medium text-zinc-700">
                Máx. ingressos (vazio = ilimitado)
                <input
                  className={cell}
                  inputMode="numeric"
                  value={row.quantidade_maxima}
                  onChange={(e) => setRow(i, { quantidade_maxima: e.target.value.replace(/\D/g, "") })}
                  placeholder="100"
                />
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-zinc-800 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={row.ativo}
                  onChange={(e) => setRow(i, { ativo: e.target.checked })}
                  className="rounded border-zinc-300"
                />
                Lote ativo (inativo não entra na fila de venda)
              </label>
              <label className="grid gap-0.5 text-xs font-medium text-zinc-700 sm:col-span-2">
                Início das vendas (opcional)
                <input
                  className={cell}
                  type="datetime-local"
                  step={60}
                  value={row.vendas_inicio}
                  onChange={(e) => setRow(i, { vendas_inicio: e.target.value })}
                />
              </label>
              <label className="grid gap-0.5 text-xs font-medium text-zinc-700 sm:col-span-2">
                Fim das vendas (opcional)
                <input
                  className={cell}
                  type="datetime-local"
                  step={60}
                  value={row.vendas_fim}
                  onChange={(e) => setRow(i, { vendas_fim: e.target.value })}
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      <button type="button" onClick={addRow} className="text-sm font-medium text-emerald-800 hover:underline">
        + Adicionar lote
      </button>
    </div>
  );
}
