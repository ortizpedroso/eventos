"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";

type FinanceiroResumo = {
  resumo: {
    receita_confirmada: number;
    receita_em_aberto: number;
    total_ingressos: number;
  };
  financeiro?: {
    receita_bruta: number;
    taxa_plataforma_estimada: number;
    liquido_estimado: number;
    nota: string;
  };
  mes_atual: {
    referencia: string;
    receita_confirmada: number;
  };
};

function fmtBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function OrganizadorFinanceiroClient() {
  const [data, setData] = useState<FinanceiroResumo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setError(null);
    try {
      const r = await apiFetch<FinanceiroResumo>("/api/relatorios/organizador?dias=90", {
        cache: "no-store",
      });
      setData(r);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Não foi possível carregar o resumo financeiro.");
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">Financeiro</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
          Visão consolidada dos seus eventos. Valores estimados com base nos ingressos pagos e na
          taxa divulgada em{" "}
          <Link href="/planos" className="font-medium text-emerald-800 underline underline-offset-2">
            Planos
          </Link>
          .
        </p>
      </div>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      {!data && !error ? <p className="text-sm text-zinc-600">A carregar resumo…</p> : null}

      {data?.financeiro ? (
        <section className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Resumo financeiro (estimado)</h2>
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
              <p className="text-xl font-bold text-emerald-800">{fmtBRL(data.financeiro.liquido_estimado)}</p>
            </div>
          </div>
          <p className="mt-4 text-xs text-zinc-500">
            Mês {data.mes_atual.referencia}: {fmtBRL(data.mes_atual.receita_confirmada)} confirmados.
            Total de {data.resumo.total_ingressos} ingresso(s) nos seus eventos.
          </p>
        </section>
      ) : null}

      {data ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Confirmado</p>
            <p className="mt-1 text-2xl font-bold text-emerald-800">{fmtBRL(data.resumo.receita_confirmada)}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Em aberto</p>
            <p className="mt-1 text-2xl font-bold text-zinc-900">{fmtBRL(data.resumo.receita_em_aberto)}</p>
          </div>
        </div>
      ) : null}

      <ul className="space-y-3 text-sm">
        <li>
          <Link
            href="/organizador/relatorios"
            className="inline-flex rounded-xl border border-emerald-200 bg-white px-4 py-3 font-medium text-emerald-900 shadow-sm ring-1 ring-emerald-200/80 transition hover:bg-emerald-50"
          >
            Relatórios completos, gráficos e exportação →
          </Link>
        </li>
        <li>
          <Link
            href="/conta/pagamentos"
            className="inline-flex rounded-xl border border-zinc-200 bg-white px-4 py-3 font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50"
          >
            Ver pagamentos da sua conta →
          </Link>
        </li>
      </ul>
    </div>
  );
}
