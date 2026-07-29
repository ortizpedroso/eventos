"use client";

import { useState, type FormEvent } from "react";

import { TurnstileWidget } from "@/components/turnstile-widget";
import { apiFetch } from "@/lib/api";

export function ContatoFormClient() {
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const form = new FormData(e.currentTarget);
    try {
      const data = await apiFetch<{ message: string; email_enviado?: boolean }>("/api/public/contato", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nome: String(form.get("nome") ?? ""),
          email: String(form.get("email") ?? ""),
          assunto: String(form.get("assunto") ?? ""),
          mensagem: String(form.get("mensagem") ?? ""),
          turnstile_token: turnstileToken,
        }),
      });
      setEnviado(true);
      void data;
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível enviar sua mensagem. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <div
        className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900"
        role="status"
      >
        <p className="font-semibold">Mensagem recebida com sucesso!</p>
        <p className="mt-1">Nossa equipe vai responder pelo e-mail que você informou.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      {erro ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>
      ) : null}

      <div className="grid gap-2">
        <label className="text-sm font-medium text-zinc-800" htmlFor="nome">
          Nome
        </label>
        <input
          id="nome"
          name="nome"
          required
          maxLength={200}
          autoComplete="name"
          className="h-10 rounded-md border border-zinc-300 px-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
        />
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium text-zinc-800" htmlFor="email">
          Seu e-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="h-10 rounded-md border border-zinc-300 px-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
        />
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium text-zinc-800" htmlFor="assunto">
          Assunto
        </label>
        <input
          id="assunto"
          name="assunto"
          required
          maxLength={200}
          placeholder="Ex.: Dúvida sobre reembolso"
          className="h-10 rounded-md border border-zinc-300 px-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
        />
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium text-zinc-800" htmlFor="mensagem">
          Mensagem
        </label>
        <textarea
          id="mensagem"
          name="mensagem"
          required
          minLength={10}
          maxLength={5000}
          rows={6}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
        />
      </div>

      <TurnstileWidget onToken={setTurnstileToken} />

      <button disabled={enviando} className="btn-success w-full" type="submit">
        {enviando ? "Enviando…" : "Enviar mensagem"}
      </button>
    </form>
  );
}
