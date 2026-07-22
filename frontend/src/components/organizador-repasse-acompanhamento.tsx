"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";

type Passo = {
  id: string;
  titulo: string;
  concluido?: boolean;
  ativo?: boolean;
  erro?: boolean;
};

type Acompanhamento = {
  repasse_status: string | null;
  repasse_status_rotulo: string;
  repasse_aprovado: boolean;
  pode_reenviar_conta?: boolean;
  atualizado_em: string | null;
  passos: Passo[];
  pode_publicar_eventos_pagos: boolean;
  detalhes?: {
    commercialInfo?: string;
    bankAccountInfo?: string;
    documentation?: string;
    general?: string;
  } | null;
};

export function OrganizadorRepasseAcompanhamento() {
  const [data, setData] = useState<Acompanhamento | null>(null);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setError(null);
    try {
      const r = await apiFetch<Acompanhamento>("/api/organizador/asaas/acompanhamento", {
        cache: "no-store",
      });
      setData(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar o andamento.");
    }
  }, []);

  useEffect(() => {
    void carregar();
    const id = window.setInterval(() => void carregar(), 20_000);
    return () => window.clearInterval(id);
  }, [carregar]);

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-600">
        Carregando andamento da conta de repasses…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-zinc-900">Conta de repasses</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Status atual:{" "}
          <strong className="text-zinc-900">{data.repasse_status_rotulo}</strong>
        </p>
        {data.repasse_aprovado ? (
          <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
            Sua conta está aprovada. Você já pode publicar eventos com ingressos pagos e receber
            repasses automaticamente em cada venda.
          </p>
        ) : (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Enquanto a conta não for aprovada, eventos pagos ficam <strong>pausados</strong> na
            vitrine. Você pode criar e editar eventos normalmente.
          </p>
        )}

        <ol className="mt-6 space-y-4">
          {data.passos.map((passo) => (
            <li key={passo.id} className="flex items-start gap-3">
              <span
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  passo.erro
                    ? "bg-red-100 text-red-700"
                    : passo.concluido
                      ? "bg-emerald-600 text-white"
                      : passo.ativo
                        ? "bg-amber-400 text-amber-950"
                        : "bg-zinc-200 text-zinc-600"
                }`}
              >
                {passo.erro ? "!" : passo.concluido ? "✓" : "…"}
              </span>
              <div>
                <p className="text-sm font-medium text-zinc-900">{passo.titulo}</p>
                {passo.ativo && !passo.concluido ? (
                  <p className="text-xs text-zinc-600">Em andamento — atualizamos a cada 20 segundos.</p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>

        {data.detalhes ? (
          <dl className="mt-6 grid gap-2 rounded-lg border border-zinc-100 bg-zinc-50 p-4 text-xs text-zinc-700 sm:grid-cols-2">
            {data.detalhes.commercialInfo ? (
              <div>
                <dt className="font-medium">Dados comerciais</dt>
                <dd>{data.detalhes.commercialInfo}</dd>
              </div>
            ) : null}
            {data.detalhes.documentation ? (
              <div>
                <dt className="font-medium">Documentação</dt>
                <dd>{data.detalhes.documentation}</dd>
              </div>
            ) : null}
            {data.detalhes.bankAccountInfo ? (
              <div>
                <dt className="font-medium">Conta bancária</dt>
                <dd>{data.detalhes.bankAccountInfo}</dd>
              </div>
            ) : null}
            {data.detalhes.general ? (
              <div>
                <dt className="font-medium">Aprovação geral</dt>
                <dd>{data.detalhes.general}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/organizador/financeiro" className="btn-outline px-4 py-2 text-sm">
          Voltar ao Financeiro
        </Link>
        {data.pode_reenviar_conta ? (
          <Link
            href="/organizador/financeiro?reenviar=1"
            className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-900"
          >
            Reenviar dados para análise
          </Link>
        ) : null}
        {data.repasse_aprovado ? (
          <Link href="/eventos/novo" className="btn-success px-4 py-2 text-sm">
            Criar evento
          </Link>
        ) : null}
      </div>
    </div>
  );
}
