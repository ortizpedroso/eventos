"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { EventoLinkPortaria } from "@/components/evento-link-portaria";
import { apiFetch } from "@/lib/api";

type Resumo = {
  evento_id: string;
  publicado: boolean;
  ingressos_pagos: number;
  ingressos_pendentes: number;
  checkins_realizados: number;
  receita_bruta: number;
  lotes_ativos: number;
  tem_link_portaria: boolean;
};

type Props = {
  eventoId: string;
  eventoSlug: string;
  eventoNome: string;
  publicado: boolean;
  urlPublica: string;
};

export function EventoOrganizadorPainel({
  eventoId,
  eventoSlug,
  eventoNome,
  publicado,
  urlPublica,
}: Props) {
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [duplicando, setDuplicando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const r = await apiFetch<Resumo>(`/api/eventos/id/${eventoId}/resumo`, { cache: "no-store" });
      setResumo(r);
    } catch {
      setResumo(null);
    }
  }, [eventoId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function duplicar() {
    if (!window.confirm("Criar uma cópia pausada deste evento com os mesmos lotes?")) return;
    setDuplicando(true);
    setMsg(null);
    try {
      const copia = await apiFetch<{ slug: string }>(`/api/eventos/id/${eventoId}/duplicar`, {
        method: "POST",
      });
      setMsg("Cópia criada! Redirecionando para editar…");
      window.location.href = `/eventos/${copia.slug}/editar`;
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Não foi possível duplicar.");
      setDuplicando(false);
    }
  }

  const receitaFmt =
    resumo != null
      ? resumo.receita_bruta.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      : "—";

  return (
    <section className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm sm:p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-900">
        Painel do organizador
      </h2>
      <p className="mt-1 text-xs text-zinc-600">{eventoNome}</p>

      {resumo ? (
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div className="rounded-lg bg-white px-3 py-2 shadow-sm">
            <dt className="text-xs text-zinc-500">Ingressos vendidos</dt>
            <dd className="text-lg font-semibold text-zinc-900">{resumo.ingressos_pagos}</dd>
          </div>
          <div className="rounded-lg bg-white px-3 py-2 shadow-sm">
            <dt className="text-xs text-zinc-500">Check-ins</dt>
            <dd className="text-lg font-semibold text-zinc-900">{resumo.checkins_realizados}</dd>
          </div>
          <div className="rounded-lg bg-white px-3 py-2 shadow-sm">
            <dt className="text-xs text-zinc-500">Pagamentos pendentes</dt>
            <dd className="text-lg font-semibold text-zinc-900">{resumo.ingressos_pendentes}</dd>
          </div>
          <div className="rounded-lg bg-white px-3 py-2 shadow-sm">
            <dt className="text-xs text-zinc-500">Receita (bruta)</dt>
            <dd className="text-lg font-semibold text-emerald-800">{receitaFmt}</dd>
          </div>
        </dl>
      ) : (
        <p className="mt-3 text-sm text-zinc-600">Carregando indicadores…</p>
      )}

      {publicado ? (
        <div className="mt-5 rounded-lg border border-emerald-300 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
            Próximos passos
          </p>
          <ul className="mt-3 space-y-2 text-sm text-zinc-700">
            <li className="flex gap-2">
              <span aria-hidden>✓</span>
              <span>Evento publicado na vitrine</span>
            </li>
            <li className="flex gap-2">
              <span>{resumo && resumo.lotes_ativos > 0 ? "✓" : "○"}</span>
              <span>Lotes de ingresso ativos ({resumo?.lotes_ativos ?? "…"})</span>
            </li>
            <li className="flex gap-2">
              <span>{resumo?.tem_link_portaria ? "✓" : "○"}</span>
              <span>Link da portaria pronto (abaixo)</span>
            </li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={urlPublica}
              target="_blank"
              rel="noreferrer"
              className="btn-outline px-3 py-1.5 text-xs"
            >
              Ver página pública
            </a>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(urlPublica);
                setMsg("Link copiado!");
              }}
              className="btn-outline px-3 py-1.5 text-xs"
            >
              Copiar link do evento
            </button>
            <Link href={`/eventos/${eventoSlug}/editar`} className="btn-outline px-3 py-1.5 text-xs">
              Editar evento
            </Link>
          </div>
        </div>
      ) : null}

      <div className="mt-4">
        <EventoLinkPortaria eventoId={eventoId} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={duplicando}
          onClick={() => void duplicar()}
          className="btn-outline px-3 py-1.5 text-xs"
        >
          {duplicando ? "Duplicando…" : "Duplicar evento"}
        </button>
        <Link href="/organizador/relatorios" className="btn-outline px-3 py-1.5 text-xs">
          Relatórios
        </Link>
      </div>

      {msg ? (
        <p className="mt-3 text-sm text-emerald-800" role="status">
          {msg}
        </p>
      ) : null}
    </section>
  );
}
