"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { apiFetch } from "@/lib/api";
import type { Evento, Usuario } from "@/lib/types";

const TOKEN_KEY = "eventosbr_token";

const ComprarIngressoLazy = dynamic(
  () =>
    import("@/components/comprar-ingresso").then((m) => ({
      default: m.ComprarIngresso,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500">
        Carregando área de pagamento…
      </div>
    ),
  },
);

type Props = { slug: string };

export function EventoPublicClient({ slug }: Props) {
  const [evento, setEvento] = useState<Evento | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<Usuario | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);

    const hasToken =
      typeof window !== "undefined" && Boolean(window.localStorage.getItem(TOKEN_KEY));

    void (async () => {
      const eventPromise = apiFetch<Evento>(`/api/eventos/${slug}`, { cache: "no-store" });
      const mePromise: Promise<Usuario | null> = hasToken
        ? apiFetch<Usuario>("/api/auth/me", { cache: "no-store" })
        : Promise.resolve(null);

      const [evRes, meRes] = await Promise.allSettled([eventPromise, mePromise]);
      if (cancelled) return;

      if (evRes.status === "rejected") {
        setErr(evRes.reason instanceof Error ? evRes.reason.message : "Evento não encontrado");
        setEvento(null);
        setMe(null);
        setLoading(false);
        return;
      }

      setEvento(evRes.value);
      if (meRes.status === "fulfilled" && meRes.value) {
        setMe(meRes.value);
      } else {
        setMe(null);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const precoFmt = useMemo(() => {
    if (!evento) return "";
    return evento.preco_ingresso.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }, [evento]);

  if (loading) {
    return (
      <div className="space-y-4 py-8 text-sm text-zinc-600">Carregando evento…</div>
    );
  }

  if (err || !evento) {
    return (
      <div className="space-y-4">
        <Link className="text-sm text-zinc-600 hover:underline" href="/">
          ← Voltar
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {err ?? "Evento não encontrado."}
        </div>
      </div>
    );
  }

  const fmtInicio = new Date(evento.data_inicio).toLocaleString("pt-BR");
  const fmtFim = new Date(evento.data_fim).toLocaleString("pt-BR");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-600">
        <Link className="hover:underline" href="/">
          ← Voltar
        </Link>
        {me &&
        evento &&
        me.tipo === "organizador" &&
        me.id === evento.organizador_id ? (
          <Link
            href={`/eventos/${slug}/editar`}
            className="font-medium text-emerald-800 hover:underline"
          >
            Editar evento
          </Link>
        ) : null}
      </div>

      {!evento.publicado ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <strong>Evento pausado.</strong> Só você (organizador) vê esta página enquanto logado.
          Não aparece na listagem pública e não é possível comprar ingressos até republicar.
        </div>
      ) : null}

      <div className="rounded-lg border bg-white p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">{evento.nome}</h1>
          <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700">
            {evento.categoria}
          </span>
        </div>
        <div className="mt-2 text-sm text-zinc-600">
          <span className="block sm:inline">Início: {fmtInicio}</span>
          <span className="mx-1 hidden sm:inline">•</span>
          <span className="block sm:inline">Fim: {fmtFim}</span>
        </div>
        <div className="mt-1 text-sm text-zinc-600">{evento.local}</div>
        <p className="mt-2 text-sm font-medium text-emerald-800">Ingresso: {precoFmt}</p>
        <p className="mt-4 whitespace-pre-line text-sm leading-6 text-zinc-800">
          {evento.descricao}
        </p>
      </div>

      {evento.publicado ? (
        <ComprarIngressoLazy
          eventoId={evento.id}
          eventoNome={evento.nome}
          precoIngresso={evento.preco_ingresso}
        />
      ) : null}
    </div>
  );
}
