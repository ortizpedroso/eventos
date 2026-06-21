"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { OrganizadorRepassesPainel } from "@/components/organizador-repasses-painel";
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
    rotulo_taxa?: string;
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
          Taxa EventosBR fixa por ingresso ({data?.financeiro?.rotulo_taxa ?? "conforme seu plano"}). Repasses e saques
          pela plataforma —{" "}
          <Link href="/planos" className="font-medium text-emerald-800 underline underline-offset-2">
            ver planos
          </Link>
          .
        </p>
      </div>

      <OrganizadorRepassesPainel />

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      {data?.financeiro ? (
        <section className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Resumo por ingressos pagos</h2>
          <p className="mt-1 text-xs text-zinc-500">{data.financeiro.nota}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-zinc-500">Receita bruta</p>
              <p className="text-xl font-bold text-zinc-900">{fmtBRL(data.financeiro.receita_bruta)}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Taxa EventosBR</p>
              <p className="text-xl font-bold text-amber-900">{fmtBRL(data.financeiro.taxa_plataforma_estimada)}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Você recebe</p>
              <p className="text-xl font-bold text-emerald-800">{fmtBRL(data.financeiro.liquido_estimado)}</p>
            </div>
          </div>
        </section>
      ) : null}

      <ul className="space-y-3 text-sm">
        <li>
          <Link
            href="/organizador/relatorios"
            className="inline-flex rounded-xl border border-emerald-200 bg-white px-4 py-3 font-medium text-emerald-900 shadow-sm ring-1 ring-emerald-200/80 transition hover:bg-emerald-50"
          >
            Relatórios por evento →
          </Link>
        </li>
      </ul>
    </div>
  );
}
