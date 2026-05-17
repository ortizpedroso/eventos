"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { apiFetch } from "@/lib/api";
import { formatEventoDataHora } from "@/lib/eventos";
import type { Evento } from "@/lib/types";

function ordenarPorCriacaoDesc(lista: Evento[]): Evento[] {
  return [...lista].sort(
    (a, b) => new Date(b.data_criacao).getTime() - new Date(a.data_criacao).getTime(),
  );
}

/** Corpo do PATCH /api/eventos/id/… (inclui lotes para não serem apagados ao publicar/pausar). */
function corpoAtualizarEvento(e: Evento, overrides: { publicado?: boolean }): Record<string, unknown> {
  const lotes = e.ingresso_lotes ?? [];
  return {
    nome: e.nome,
    descricao: e.descricao,
    data_inicio: e.data_inicio,
    data_fim: e.data_fim,
    local: e.local,
    imagem_url: e.imagem_url ?? null,
    preco_ingresso: e.preco_ingresso,
    categoria: e.categoria,
    mensagem_confirmacao: e.mensagem_confirmacao ?? null,
    publicado: overrides.publicado ?? e.publicado,
    ingresso_lotes: lotes.map((l) => ({
      id: l.id,
      nome: l.nome,
      preco: l.preco,
      ordem: l.ordem,
      quantidade_maxima: l.quantidade_maxima,
      ativo: l.ativo,
      vendas_inicio: l.vendas_inicio,
      vendas_fim: l.vendas_fim,
    })),
  };
}

export default function OrganizadorMeusEventosPage() {
  const [items, setItems] = useState<Evento[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publishBusyId, setPublishBusyId] = useState<string | null>(null);
  const [publishErr, setPublishErr] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    const data = await apiFetch<Evento[]>("/api/eventos/meus", { cache: "no-store" });
    setItems(data);
    setError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<Evento[]>("/api/eventos/meus", { cache: "no-store" });
        if (!cancelled) {
          setItems(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Não foi possível carregar os eventos");
          setItems([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function publicarNaVitrine(e: Evento) {
    setPublishErr(null);
    setPublishBusyId(e.id);
    try {
      await apiFetch<Evento>(`/api/eventos/id/${e.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(corpoAtualizarEvento(e, { publicado: true })),
      });
      await recarregar();
    } catch (err) {
      setPublishErr(err instanceof Error ? err.message : "Não foi possível publicar");
    } finally {
      setPublishBusyId(null);
    }
  }

  const ordenados = useMemo(() => (items ? ordenarPorCriacaoDesc(items) : null), [items]);
  const qtdPausados = useMemo(
    () => (items ? items.filter((x) => !x.publicado).length : 0),
    [items],
  );

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">Meus eventos</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Do mais recente ao mais antigo. Só os marcados como <strong className="text-zinc-800">Publicado</strong>{" "}
        aparecem na página <Link href="/eventos" className="font-medium text-emerald-800 underline-offset-2 hover:underline">Eventos</Link> para qualquer pessoa comprar ingresso.
      </p>

      <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm leading-relaxed text-emerald-950 ring-1 ring-emerald-200/80 sm:px-5">
        <strong className="font-semibold">Pausado</strong> = continua na sua lista, mas{" "}
        <strong className="font-semibold">não</strong> entra na vitrine nem permite venda pública até republicar.
        {qtdPausados > 0 ? (
          <span className="mt-1 block text-emerald-900">
            Neste momento você tem <strong className="font-semibold">{qtdPausados}</strong>{" "}
            {qtdPausados === 1 ? "evento pausado" : "eventos pausados"}.
          </span>
        ) : null}
      </div>

      {publishErr ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{publishErr}</p>
      ) : null}

      {ordenados === null ? (
        <p className="mt-8 text-sm text-zinc-500">Carregando…</p>
      ) : ordenados.length === 0 ? (
        error ? (
          <p className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </p>
        ) : (
          <div className="mt-8 rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm ring-1 ring-emerald-200/60">
            <p className="text-sm text-zinc-600">Você ainda não criou nenhum evento.</p>
            <Link href="/organizador/novo" className="btn-success mt-4 inline-flex px-6 py-2.5 text-sm shadow-sm">
              Criar primeiro evento
            </Link>
          </div>
        )
      ) : (
        <ul className="mt-8 grid grid-cols-1 gap-6 text-left sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {ordenados.map((e) => {
            const fmtInicio = formatEventoDataHora(e.data_inicio);
            const criado = new Date(e.data_criacao).toLocaleString("pt-BR", {
              dateStyle: "short",
              timeStyle: "short",
            });
            const preco = (e.preco_compra ?? e.preco_ingresso).toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            });
            const resumo =
              e.descricao.length > 120 ? `${e.descricao.slice(0, 120).trim()}…` : e.descricao;

            return (
              <li key={e.id} className="flex min-h-0">
                <article className="flex h-full min-h-[280px] w-full flex-col rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition-colors hover:border-emerald-600 hover:shadow-md hover:ring-1 hover:ring-emerald-600 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h2 className="text-lg font-semibold leading-snug text-zinc-900">{e.nome}</h2>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        e.publicado
                          ? "bg-emerald-100 text-emerald-900"
                          : "bg-zinc-200 text-zinc-700"
                      }`}
                    >
                      {e.publicado ? "Publicado" : "Pausado"}
                    </span>
                  </div>
                  <span className="mt-2 inline-flex w-fit rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                    {e.categoria}
                  </span>
                  <p className="mt-3 line-clamp-3 flex-1 text-sm leading-6 text-zinc-600">{resumo}</p>
                  <div className="mt-4 space-y-1 text-xs text-zinc-500">
                    <p>
                      <span className="font-medium text-zinc-700">Início:</span> {fmtInicio}
                    </p>
                    <p>
                      <span className="font-medium text-zinc-700">Local:</span>{" "}
                      <span className="line-clamp-2">{e.local}</span>
                    </p>
                    <p>
                      <span className="font-medium text-zinc-700">Criado em:</span> {criado}
                    </p>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-emerald-800">Ingresso a partir de {preco}</p>
                  {!e.publicado ? (
                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-950">
                      Fora da vitrine: visitantes não veem na lista de eventos e não podem comprar até você
                      publicar.
                      <button
                        type="button"
                        disabled={publishBusyId === e.id}
                        onClick={() => void publicarNaVitrine(e)}
                        className="mt-2 block w-full rounded-lg bg-emerald-700 px-3 py-2 text-center text-sm font-medium text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-60"
                      >
                        {publishBusyId === e.id ? "Publicando…" : "Publicar na vitrine agora"}
                      </button>
                    </div>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-zinc-100 pt-4">
                    <Link href={`/eventos/${e.slug}`} className="btn-outline flex-1 px-3 py-2 text-center text-sm sm:flex-none">
                      Ver página
                    </Link>
                    <Link
                      href={`/eventos/${e.slug}/editar`}
                      className="btn-success flex-1 px-3 py-2 text-center text-sm text-white sm:flex-none"
                    >
                      Editar
                    </Link>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
