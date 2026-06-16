"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ContaNav } from "@/components/conta-nav";
import { ContinuarPagamentoLink } from "@/components/continuar-pagamento-link";
import { apiFetch } from "@/lib/api";
import { classeBadgeStatus, labelStatusIngresso } from "@/lib/ingresso-status";
import type { IngressoListItem } from "@/lib/types";

function PendenteBadge({ reservadoAte }: { reservadoAte: string }) {
  const [secs, setSecs] = useState<number | null>(null);

  useEffect(() => {
    const expiry = new Date(reservadoAte).getTime();
    const calc = () => setSecs(Math.max(0, Math.floor((expiry - Date.now()) / 1000)));
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [reservadoAte]);

  if (secs === null) return null;

  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");

  if (secs === 0) {
    return (
      <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
        Reserva expirada
      </div>
    );
  }
  return (
    <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
      <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
      </svg>
      Aguardando pagamento · {mm}:{ss}
    </div>
  );
}

export default function MeusIngressosPage() {
  const [items, setItems] = useState<IngressoListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<IngressoListItem[]>("/api/ingressos/meus", {
          cache: "no-store",
        });
        if (!cancelled) setItems(data);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Não foi possível carregar ingressos",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Meus ingressos</h1>
        <Link href="/eventos" className="text-sm text-zinc-600 hover:underline">
          ← Eventos
        </Link>
      </div>

      <ContaNav />

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
          <div className="mt-2">
            <Link href="/auth" className="underline">
              Fazer login
            </Link>
          </div>
        </div>
      ) : null}

      {items === null && !error ? (
        <p className="text-sm text-zinc-600">Carregando ingressos…</p>
      ) : null}

      {items && !items.length ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-zinc-600">Você ainda não tem ingressos.</p>
          <p className="mt-2 text-sm text-zinc-500">
            Explore eventos publicados e garanta o seu lugar em poucos cliques.
          </p>
          <Link href="/eventos" className="btn-success mt-6 inline-flex px-6 py-3 text-base shadow-sm">
            Explorar eventos
          </Link>
        </div>
      ) : null}

      {items && items.length > 0 ? (
        <ul className="space-y-3">
          {items.map((it) => (
            <li
              key={it.id}
              className="rounded-lg border bg-white p-4 text-sm shadow-sm"
            >
              <div className="font-medium">{it.evento.nome}</div>
              <div className="mt-1 text-zinc-600">
                {new Date(it.evento.data).toLocaleString("pt-BR")} • {it.evento.local}
              </div>
              {it.participante_nome ? (
                <div className="mt-2 text-xs text-zinc-600">
                  <span className="font-medium text-zinc-800">Participante: </span>
                  {it.participante_nome}
                  {it.participante_email ? ` (${it.participante_email})` : ""}
                </div>
              ) : null}
              {it.status === "pendente" && it.reservado_ate ? (
                <PendenteBadge reservadoAte={it.reservado_ate} />
              ) : null}
              {it.repassado_em ? (
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 3M21 7.5H7.5" />
                  </svg>
                  Repassado para {it.repassado_para_nome}
                </div>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-zinc-500">
                  Valor:{" "}
                  {it.valor.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 font-medium ${classeBadgeStatus(it.status)}`}
                >
                  {labelStatusIngresso(it.status)}
                </span>
                <span className="text-zinc-500">
                  Compra: {new Date(it.data_compra).toLocaleString("pt-BR")}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <ContinuarPagamentoLink
                  ingressoId={it.id}
                  eventoSlug={it.evento.slug}
                  reservadoAte={it.reservado_ate}
                  status={it.status}
                />
                <Link
                  href={`/conta/ingressos/${it.id}`}
                  className="text-sm font-medium text-emerald-800 underline-offset-2 hover:underline"
                >
                  Opções do ingresso (PDF / e-mail) →
                </Link>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
