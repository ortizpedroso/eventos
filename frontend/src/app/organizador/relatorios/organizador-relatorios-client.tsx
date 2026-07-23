"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { PainelKpiSkeleton } from "@/components/painel-kpi-skeleton";
import { apiFetch, getApiBaseUrl } from "@/lib/api";
import {
  ORGANIZADOR_CACHE_KEYS,
  readOrganizadorCache,
  writeOrganizadorCache,
} from "@/lib/organizador-session-cache";

type RelatorioOrganizador = {
  resumo: {
    total_ingressos: number;
    por_status: Record<string, number>;
    receita_confirmada: number;
    receita_em_aberto: number;
  };
  financeiro?: {
    receita_bruta: number;
    taxa_plataforma_estimada: number;
    liquido_estimado: number;
    nota: string;
  };
  mes_atual: {
    referencia: string;
    por_status: Record<string, number>;
    receita_confirmada: number;
  };
  por_evento: Array<{
    evento_id: string;
    nome: string;
    slug: string;
    publicado: boolean;
    por_status: Record<string, number>;
    receita_paga: number;
    total_ingressos: number;
    vagas_restantes: number | null;
    conversao_pct: number | null;
  }>;
  serie_diaria: Array<{ dia: string; ingressos_pagos: number; receita: number }>;
  periodo_grafico_dias: number;
  opcoes_evento?: Array<{ evento_id: string; nome: string; publicado: boolean }>;
};

const STATUS_LEGENDA: Record<string, string> = {
  pendente: "Aguardando pagamento",
  pago: "Pagamento confirmado",
  cancelado: "Cancelado",
  usado: "Utilizado",
  outros: "Outros",
};

function fmtBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDataCurta(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

/** Agrupa dias para caber em ~28 barras sem perder o total do período. */
function serieParaBarras(
  serie: RelatorioOrganizador["serie_diaria"],
  maxBarras: number,
): Array<{ key: string; label: string; receita: number; ingressos_pagos: number }> {
  if (serie.length === 0) return [];
  if (serie.length <= maxBarras) {
    return serie.map((s) => ({
      key: s.dia,
      label: fmtDataCurta(s.dia),
      receita: s.receita,
      ingressos_pagos: s.ingressos_pagos,
    }));
  }
  const step = Math.ceil(serie.length / maxBarras);
  const out: Array<{ key: string; label: string; receita: number; ingressos_pagos: number }> = [];
  for (let i = 0; i < serie.length; i += step) {
    const chunk = serie.slice(i, Math.min(i + step, serie.length));
    const receita = chunk.reduce((a, b) => a + b.receita, 0);
    const ingressos_pagos = chunk.reduce((a, b) => a + b.ingressos_pagos, 0);
    const last = chunk[chunk.length - 1];
    out.push({
      key: `${chunk[0].dia}_${last.dia}`,
      label: fmtDataCurta(chunk[0].dia) + " – " + fmtDataCurta(last.dia),
      receita,
      ingressos_pagos,
    });
  }
  return out;
}

export function OrganizadorRelatoriosClient() {
  const [dias, setDias] = useState(90);
  const [eventoFiltro, setEventoFiltro] = useState<string>("");
  const [data, setData] = useState<RelatorioOrganizador | null>(
    () => readOrganizadorCache<RelatorioOrganizador>(ORGANIZADOR_CACHE_KEYS.relatorios) ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [csvBusy, setCsvBusy] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    p.set("dias", String(dias));
    if (eventoFiltro) p.set("evento_id", eventoFiltro);
    return p.toString();
  }, [dias, eventoFiltro]);

  const carregar = useCallback(async () => {
    setError(null);
    try {
      const r = await apiFetch<RelatorioOrganizador>(
        `/api/relatorios/organizador?${query}`,
        { cache: "no-store" },
      );
      setData(r);
      writeOrganizadorCache(ORGANIZADOR_CACHE_KEYS.relatorios, r);
    } catch (e) {
      if (!readOrganizadorCache(ORGANIZADOR_CACHE_KEYS.relatorios)) {
        setData(null);
      }
      setError(e instanceof Error ? e.message : "Não foi possível carregar os relatórios.");
    }
  }, [query]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(() => {
      void carregar();
    }, 60_000);
    return () => window.clearInterval(id);
  }, [autoRefresh, carregar]);

  const pagos = data?.resumo.por_status.pago ?? 0;
  const pendentes = data?.resumo.por_status.pendente ?? 0;

  const barrasEvento = useMemo(() => {
    if (!data?.por_evento.length) return [];
    const comVenda = data.por_evento.filter((e) => e.total_ingressos > 0 || e.receita_paga > 0);
    const lista = comVenda.length ? comVenda : data.por_evento;
    const maxR = Math.max(...lista.map((e) => e.receita_paga), 1);
    return lista
      .map((e) => ({
        ...e,
        pct: Math.round((e.receita_paga / maxR) * 100),
      }))
      .sort((a, b) => b.receita_paga - a.receita_paga)
      .slice(0, 12);
  }, [data]);

  const barrasDia = useMemo(() => {
    if (!data?.serie_diaria.length) return [];
    return serieParaBarras(data.serie_diaria, 28);
  }, [data]);

  const maxBarraDia = useMemo(() => Math.max(...barrasDia.map((b) => b.receita), 1), [barrasDia]);

  const downloadArquivo = useCallback(
    async (formato: "csv" | "pdf" | "xlsx") => {
    setCsvBusy(true);
    try {
      const params = new URLSearchParams({ formato });
      if (eventoFiltro) params.set("evento_id", eventoFiltro);
      const base = getApiBaseUrl();
      const headers = new Headers();
      const accept =
        formato === "pdf"
          ? "application/pdf"
          : formato === "xlsx"
            ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            : "text/csv";
      headers.set("accept", accept);
      const res = await fetch(`${base}/api/relatorios/organizador/participantes?${params}`, {
        headers,
        credentials: "include",
      });
      if (!res.ok) {
        let msg = `Erro ${res.status}`;
        try {
          const j = (await res.json()) as { detail?: string };
          if (typeof j.detail === "string") msg = j.detail;
        } catch {
          // ignore
        }
        throw new Error(msg);
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition");
      let filename = `participantes_eventosbr.${formato}`;
      const m = cd?.match(/filename="([^"]+)"/);
      if (m?.[1]) filename = m[1];
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao baixar CSV");
    } finally {
      setCsvBusy(false);
    }
  },
    [eventoFiltro],
  );

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
          Relatórios em linguagem simples
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-600">
          Números e gráficos mostram só os <strong className="font-semibold text-zinc-800">seus</strong>{" "}
          eventos. <strong className="font-semibold text-zinc-800">Receita confirmada</strong> soma
          ingressos já pagos; <strong className="font-semibold text-zinc-800">em aberto</strong> são
          pedidos ainda não concluídos no pagamento.
        </p>
        <p className="mt-2 text-sm text-zinc-500">
          Quer o detalhe de cada cobrança? Veja também{" "}
          <Link href="/organizador/perfil/pagamentos" className="font-medium text-emerald-800 underline-offset-2 hover:underline">
            Meus pagamentos
          </Link>
          .
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm ring-1 ring-emerald-200/60 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-6 sm:p-5">
        <div className="grid gap-2">
          <label htmlFor="rel-dias" className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
            Período do gráfico de vendas
          </label>
          <select
            id="rel-dias"
            className="h-10 max-w-xs rounded-lg border border-emerald-200 bg-white px-3 text-sm text-zinc-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
            value={dias}
            onChange={(e) => setDias(Number(e.target.value))}
          >
            <option value={30}>Últimos 30 dias</option>
            <option value={90}>Últimos 90 dias</option>
            <option value={180}>Últimos 6 meses (aprox.)</option>
          </select>
        </div>
        <div className="grid flex-1 gap-2 sm:min-w-[14rem]">
          <label htmlFor="rel-evento" className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
            Filtrar por evento (opcional)
          </label>
          <select
            id="rel-evento"
            className="h-10 w-full rounded-lg border border-emerald-200 bg-white px-3 text-sm text-zinc-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
            value={eventoFiltro}
            onChange={(e) => setEventoFiltro(e.target.value)}
            disabled={!data}
          >
            <option value="">Todos os meus eventos</option>
            {(data?.opcoes_evento ?? data?.por_evento ?? []).map((e) => (
              <option key={e.evento_id} value={e.evento_id}>
                {e.nome}
                {!e.publicado ? " (pausado)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void downloadArquivo("csv")}
            disabled={csvBusy}
            className="h-10 shrink-0 rounded-lg border border-emerald-700 bg-emerald-700 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-60"
          >
            {csvBusy ? "Gerando…" : "CSV"}
          </button>
          <button
            type="button"
            onClick={() => void downloadArquivo("xlsx")}
            disabled={csvBusy}
            className="h-10 shrink-0 rounded-lg border border-emerald-300 bg-white px-4 text-sm font-medium text-emerald-900 shadow-sm hover:bg-emerald-50 disabled:opacity-60"
          >
            Excel
          </button>
          <button
            type="button"
            onClick={() => void downloadArquivo("pdf")}
            disabled={csvBusy}
            className="h-10 shrink-0 rounded-lg border border-emerald-300 bg-white px-4 text-sm font-medium text-emerald-900 shadow-sm hover:bg-emerald-50 disabled:opacity-60"
          >
            PDF
          </button>
        </div>
        <label className="flex items-center gap-2 text-xs text-zinc-600 sm:col-span-2">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            className="rounded border-zinc-300"
          />
          Atualizar números automaticamente a cada 1 minuto
        </label>
      </div>
      <p className="-mt-6 text-xs text-zinc-500">
        Exporte lista de presença (CSV, Excel ou PDF). Use o filtro de evento para listas menores.
      </p>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {!data && !error ? (
        <PainelKpiSkeleton />
      ) : data ? (
        <>
          <section aria-labelledby="kpi-heading">
            <h2 id="kpi-heading" className="sr-only">
              Principais indicadores
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm ring-1 ring-emerald-100">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                  Ingressos confirmados
                </p>
                <p className="mt-2 text-3xl font-bold tabular-nums text-zinc-900">{pagos}</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-600">
                  Pagamentos já aprovados (dinheiro contabilizado em receita abaixo).
                </p>
              </div>
              <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50/80 to-white p-5 shadow-sm ring-1 ring-amber-100">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">
                  Ainda no pagamento
                </p>
                <p className="mt-2 text-3xl font-bold tabular-nums text-zinc-900">{pendentes}</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-600">
                  Compras iniciadas ou pendentes — podem virar confirmadas automaticamente.
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  Receita confirmada (total)
                </p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-emerald-800 sm:text-3xl">
                  {fmtBRL(data.resumo.receita_confirmada)}
                </p>
                <p className="mt-1 text-xs text-zinc-500">Soma dos ingressos com status “pago”.</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  Valor em pedidos abertos
                </p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-900 sm:text-3xl">
                  {fmtBRL(data.resumo.receita_em_aberto)}
                </p>
                <p className="mt-1 text-xs text-zinc-500">Ingressos “pendente” (ainda não pago).</p>
              </div>
            </div>
          </section>

          {data.financeiro ? (
            <section
              className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-5 shadow-sm sm:p-6"
              aria-labelledby="financeiro-heading"
            >
              <h2 id="financeiro-heading" className="text-sm font-semibold text-zinc-900">
                Resumo financeiro (estimado)
              </h2>
              <p className="mt-1 text-xs text-zinc-500">{data.financeiro.nota}</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-zinc-500">Receita bruta (pagos)</p>
                  <p className="text-xl font-bold text-zinc-900">{fmtBRL(data.financeiro.receita_bruta)}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Taxa plataforma</p>
                  <p className="text-xl font-bold text-amber-900">
                    {fmtBRL(data.financeiro.taxa_plataforma_estimada)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Líquido estimado</p>
                  <p className="text-xl font-bold text-emerald-800">
                    {fmtBRL(data.financeiro.liquido_estimado)}
                  </p>
                </div>
              </div>
            </section>
          ) : null}

          <section
            className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm ring-1 ring-emerald-200/50 sm:p-6"
            aria-labelledby="mes-heading"
          >
            <h2 id="mes-heading" className="text-sm font-semibold text-zinc-900">
              Este mês ({data.mes_atual.referencia})
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              Recorte do calendário: vendas registradas desde o dia 1 até hoje.
            </p>
            <div className="mt-4 flex flex-wrap items-baseline gap-6">
              <div>
                <p className="text-xs text-zinc-500">Receita confirmada no mês</p>
                <p className="text-xl font-bold tabular-nums text-emerald-800">
                  {fmtBRL(data.mes_atual.receita_confirmada)}
                </p>
              </div>
              <ul className="flex flex-wrap gap-3 text-xs">
                {Object.entries(data.mes_atual.por_status).map(([k, v]) => (
                  <li
                    key={k}
                    className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-zinc-700"
                  >
                    <span className="font-medium">{STATUS_LEGENDA[k] ?? k}:</span> {v}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section aria-labelledby="chart-dia-heading">
            <h2 id="chart-dia-heading" className="text-base font-semibold text-zinc-900">
              Vendas confirmadas ao longo do tempo
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              Altura de cada barra = receita dos ingressos pagos naquele intervalo (eixos agrupados
              quando o período é longo).
            </p>
            <div className="mt-6 flex h-52 gap-1 overflow-x-auto pb-2 pt-2 sm:h-60 sm:gap-1.5">
              {barrasDia.map((b) => {
                const hPct =
                  maxBarraDia > 0 ? Math.max((b.receita / maxBarraDia) * 100, b.receita > 0 ? 4 : 0.5) : 0;
                return (
                  <div
                    key={b.key}
                    className="group flex h-full min-w-[1.25rem] flex-1 flex-col justify-end"
                    title={`${b.label}: ${fmtBRL(b.receita)} · ${b.ingressos_pagos} ingresso(s)`}
                  >
                    <div
                      className="mx-auto w-full max-w-[2rem] rounded-t-md bg-emerald-500 transition group-hover:bg-emerald-600"
                      style={{ height: `${hPct}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-center text-xs text-zinc-400">
              Passe o mouse nas barras para ver valores
            </p>
          </section>

          <section aria-labelledby="chart-evento-heading">
            <h2 id="chart-evento-heading" className="text-base font-semibold text-zinc-900">
              Receita confirmada por evento
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              Comparação rápida: barra maior = mais dinheiro já confirmado naquele evento.
            </p>
            <ul className="mt-6 space-y-4">
              {barrasEvento.map((e) => (
                <li key={e.evento_id}>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate font-medium text-zinc-800" title={e.nome}>
                      {e.nome}
                      {!e.publicado ? (
                        <span className="ml-1 text-xs font-normal text-amber-700">(pausado)</span>
                      ) : null}
                    </span>
                    <span className="shrink-0 tabular-nums text-emerald-800">{fmtBRL(e.receita_paga)}</span>
                  </div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-emerald-100">
                    <div
                      className="h-full rounded-full bg-emerald-600"
                      style={{ width: `${e.pct}%` }}
                    />
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {e.total_ingressos} pedido(s) no total · {e.por_status.pago ?? 0} pago(s)
                    {e.vagas_restantes != null ? ` · ${e.vagas_restantes} vaga(s) restante(s)` : ""}
                    {e.conversao_pct != null ? ` · conversão ${e.conversao_pct}%` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="status-heading">
            <h2 id="status-heading" className="text-base font-semibold text-zinc-900">
              Situação de todos os ingressos (filtro aplicado)
            </h2>
            <div className="mt-4 flex flex-wrap gap-3">
              {Object.entries(data.resumo.por_status).map(([k, v]) => {
                const total = Math.max(data.resumo.total_ingressos, 1);
                const pct = Math.round((v / total) * 100);
                return (
                  <div
                    key={k}
                    className="min-w-[10rem] flex-1 rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-3"
                  >
                    <p className="text-xs font-medium text-zinc-600">{STATUS_LEGENDA[k] ?? k}</p>
                    <p className="text-lg font-bold tabular-nums text-zinc-900">{v}</p>
                    <p className="text-xs text-zinc-500">{pct}% do total</p>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
