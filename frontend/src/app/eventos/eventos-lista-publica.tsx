"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { authHrefParaCriarEvento } from "@/lib/criar-evento-routes";
import { resolveEventoImagemSrc } from "@/lib/evento-imagem-url";
import { formatEventoDataHora } from "@/lib/eventos";
import type { Evento } from "@/lib/types";

/**
 * Lista carregada no browser (não no SSR), para usar o mesmo `/api` que o utilizador
 * e evitar listas vazias quando o servidor Next aponta para outra instância da API.
 */
export function EventosListaPublica() {
  const [eventos, setEventos] = useState<Evento[] | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setFetchError(null);
      try {
        const data = await apiFetch<Evento[]>("/api/eventos?limit=50", { cache: "no-store" });
        if (!cancelled) setEventos(data);
      } catch {
        if (!cancelled) {
          setFetchError("Não foi possível carregar a lista agora. Tente novamente em instantes.");
          setEventos([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [retryCount]);

  if (eventos === null) {
    return (
      <div className="mx-auto mt-16 max-w-4xl sm:mt-20">
        <p className="text-center text-sm text-zinc-500">A carregar eventos…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-16 max-w-4xl sm:mt-20">
      {fetchError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center shadow-sm">
          <p className="text-base font-medium text-red-800">{fetchError}</p>
          <button
            onClick={() => setRetryCount((c) => c + 1)}
            className="mt-6 inline-flex items-center justify-center rounded-lg border border-red-300 bg-white px-5 py-2.5 text-sm font-medium text-red-700 shadow-sm transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            ⟳ Tentar novamente
          </button>
        </div>
      ) : null}

      {!fetchError && eventos.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-zinc-600">
            Ainda não há eventos publicados na vitrine — ou o seu está{" "}
            <strong className="font-semibold text-zinc-800">pausado</strong> (só aparece em{" "}
            <Link href="/organizador/eventos" className="font-medium text-emerald-800 underline-offset-2 hover:underline">
              Meus eventos
            </Link>{" "}
            até republicar).
          </p>
          <div className="mt-6 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:justify-center">
            <Link href={authHrefParaCriarEvento()} className="btn-success px-6 py-3 text-base shadow-sm">
              Criar evento
            </Link>
            <Link href="/auth?mode=register" className="btn-outline px-6 py-3 text-base shadow-sm">
              Criar conta
            </Link>
          </div>
        </div>
      ) : null}

      {!fetchError && eventos.length > 0 ? (
        <ul className="grid grid-cols-1 gap-6 text-left sm:grid-cols-2 lg:gap-8">
          {eventos.map((e) => {
            const fmtInicio = formatEventoDataHora(e.data_inicio);
            const preco = e.preco_ingresso.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            });
            const resumo =
              e.descricao.length > 140 ? `${e.descricao.slice(0, 140).trim()}…` : e.descricao;

            const thumbSrc = resolveEventoImagemSrc(e.imagem_url);

            return (
              <li key={e.id}>
                <Link
                  href={`/eventos/${e.slug}`}
                  className="block h-full rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition-colors hover:border-emerald-600 hover:shadow-md hover:ring-1 hover:ring-emerald-600 sm:p-8"
                >
                  {thumbSrc ? (
                    <div className="-mx-6 -mt-6 mb-4 overflow-hidden rounded-t-2xl border-b border-zinc-100 sm:-mx-8 sm:-mt-8">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={thumbSrc}
                        alt={e.nome}
                        className="aspect-video h-auto max-h-52 w-full object-cover sm:max-h-56"
                        loading="lazy"
                      />
                    </div>
                  ) : null}
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h2 className="text-lg font-semibold text-zinc-900">{e.nome}</h2>
                    <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700">
                      {e.categoria}
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-zinc-600">{resumo}</p>
                  <div className="mt-4 space-y-1 text-xs text-zinc-500">
                    <p>
                      <span className="font-medium text-zinc-700">Início:</span> {fmtInicio}
                    </p>
                    <p>
                      <span className="font-medium text-zinc-700">Local:</span> {e.local}
                    </p>
                  </div>
                  <p className="mt-4 text-sm font-semibold text-emerald-800">A partir de {preco}</p>
                  <span className="mt-4 inline-block text-sm font-medium text-emerald-700">
                    Ver detalhes →
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
