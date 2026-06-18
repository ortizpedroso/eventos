"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";

type QrPreview = {
  codigo: string;
  status: string;
  evento: { nome: string; data: string | null; local: string };
  participante_nome: string | null;
};

export function IngressoQrClient() {
  const params = useSearchParams();
  const codigo = (params.get("c") || "").trim();
  const [preview, setPreview] = useState<QrPreview | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(codigo));

  useEffect(() => {
    if (!codigo) return;
    let cancelled = false;
    setLoading(true);
    setErro(null);
    apiFetch<QrPreview>(`/api/ingressos/qr-preview?c=${encodeURIComponent(codigo)}`, {
      cache: "no-store",
    })
      .then((data) => {
        if (!cancelled) setPreview(data);
      })
      .catch(() => {
        if (!cancelled) {
          setPreview(null);
          setErro("Não foi possível carregar os dados deste ingresso. Verifique o link ou abra em Minha conta.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [codigo]);

  if (!codigo) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-12 text-center">
        <h1 className="text-xl font-semibold text-zinc-900">Ingresso EventosBR</h1>
        <p className="text-sm text-zinc-600">Link inválido ou incompleto. Abra o ingresso em Minha conta.</p>
        <Link href="/conta/ingressos" className="inline-block text-sm font-medium text-emerald-800 underline">
          Meus ingressos
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-md py-16 text-center text-sm text-zinc-500">A carregar ingresso…</div>
    );
  }

  const codigoExibir = preview?.codigo || codigo;
  const dataFmt =
    preview?.evento.data != null
      ? new Date(preview.evento.data).toLocaleString("pt-BR", {
          dateStyle: "short",
          timeStyle: "short",
        })
      : null;

  return (
    <div className="mx-auto max-w-md space-y-6 py-8">
      <header className="text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">EventosBR</p>
        <h1 className="mt-1 text-2xl font-bold text-zinc-900">
          {preview?.evento.nome ?? "Seu ingresso"}
        </h1>
        {preview?.participante_nome ? (
          <p className="mt-2 text-sm font-medium text-zinc-800">{preview.participante_nome}</p>
        ) : null}
        {dataFmt || preview?.evento.local ? (
          <p className="mt-1 text-sm text-zinc-600">
            {[dataFmt, preview?.evento.local].filter(Boolean).join(" · ")}
          </p>
        ) : null}
        <p className="mt-3 text-sm text-zinc-600">
          Apresente este código ou o QR na entrada. Cada ingresso só entra uma vez.
        </p>
      </header>

      {erro ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950" role="alert">
          {erro}
        </p>
      ) : null}

      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900">
          Código para digitar na portaria
        </p>
        <p className="mt-3 break-all rounded-lg border border-emerald-200 bg-white px-3 py-3 font-mono text-sm font-semibold text-zinc-900">
          {codigoExibir}
        </p>
      </div>

      <p className="text-center text-xs leading-relaxed text-zinc-500">
        Se você é quem valida na entrada, use o link da portaria enviado pelo organizador — a câmera
        desse link lê o QR automaticamente.
      </p>

      <button
        type="button"
        disabled
        title="Em breve — Apple Wallet e Google Wallet"
        className="mx-auto block w-full max-w-xs cursor-not-allowed rounded-lg border border-zinc-200 bg-zinc-100 px-4 py-2 text-sm text-zinc-500"
      >
        Adicionar à Carteira (em breve)
      </button>

      <p className="text-center">
        <Link href="/conta/ingressos" className="text-sm font-medium text-emerald-800 underline">
          Ver todos os meus ingressos
        </Link>
      </p>
    </div>
  );
}
