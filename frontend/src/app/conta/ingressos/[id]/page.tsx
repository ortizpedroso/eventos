"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { apiFetch, getApiBaseUrl } from "@/lib/api";

export default function IngressoDetalhePage() {
  const params = useParams();
  const ingressoId =
    typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";

  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");

  async function openDownloadPdf() {
    if (!ingressoId) return;
    const token =
      typeof window !== "undefined" ? window.localStorage.getItem("eventosbr_token") : null;
    const headers = new Headers();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const base = getApiBaseUrl();
    const path = `${base}/api/ingressos/${ingressoId}/download`;
    const res = await fetch(path, { headers, cache: "no-store" });
    if (!res.ok) {
      setMessage("Não foi possível abrir o ingresso para impressão.");
      return;
    }
    const html = await res.text();
    const w = window.open("", "_blank", "noopener,noreferrer");
    if (w) {
      w.document.write(html);
      w.document.close();
    } else {
      setMessage("Permita pop-ups para abrir o ingresso numa nova janela.");
    }
  }

  const handleSendEmail = async (e: FormEvent) => {
    e.preventDefault();
    if (!ingressoId) return;
    setSending(true);
    setMessage("");

    try {
      const data = await apiFetch<{ message?: string }>(
        `/api/ingressos/${ingressoId}/enviar-email`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: email.trim() || null }),
        },
      );
      setMessage(data.message ?? "Ingresso enviado com sucesso!");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Ocorreu um erro ao enviar o ingresso.");
    } finally {
      setSending(false);
    }
  };

  if (!ingressoId) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <p className="text-sm text-zinc-600">Ingresso inválido.</p>
        <Link href="/conta/ingressos" className="mt-4 inline-block text-sm text-emerald-800 underline">
          Voltar aos meus ingressos
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link href="/conta/ingressos" className="text-sm text-zinc-600 hover:underline">
          ← Meus ingressos
        </Link>
      </div>
      <h1 className="mb-8 text-3xl font-extrabold text-zinc-900">Opções do ingresso</h1>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="flex flex-col items-start rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-zinc-900">Baixar / imprimir</h2>
          <p className="mt-2 mb-6 text-justify text-sm text-zinc-600">
            Abre o ingresso numa nova janela para imprimir ou guardar como PDF (função do
            navegador).
          </p>

          <button
            type="button"
            onClick={() => void openDownloadPdf()}
            className="mt-auto w-full rounded-lg bg-emerald-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
          >
            Gerar vista para impressão / PDF
          </button>
        </div>

        <div className="flex flex-col items-start rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-zinc-900">Enviar por e-mail</h2>
          <p className="mt-2 mb-6 text-justify text-sm text-zinc-600">
            Deixe o campo em branco para o seu e-mail de conta ou indique outro destinatário.
          </p>

          <form onSubmit={(e) => void handleSendEmail(e)} className="mt-auto flex w-full flex-col gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Outro e-mail (opcional)"
              className="w-full rounded-lg border-0 px-3 py-2.5 text-zinc-900 ring-1 ring-inset ring-zinc-300 focus:ring-2 focus:ring-inset focus:ring-emerald-600 sm:text-sm"
            />
            <button
              type="submit"
              disabled={sending}
              className="w-full rounded-lg bg-zinc-900 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:bg-zinc-400"
            >
              {sending ? "A enviar…" : "Enviar ingresso"}
            </button>
            {message ? (
              <p
                className={`text-sm font-medium ${
                  message.toLowerCase().includes("erro") || message.includes("Não foi")
                    ? "text-red-600"
                    : "text-emerald-600"
                }`}
              >
                {message}
              </p>
            ) : null}
          </form>
        </div>
      </div>
    </div>
  );
}
