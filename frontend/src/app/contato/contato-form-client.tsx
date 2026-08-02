"use client";

import { useRef, useState, type FormEvent } from "react";

import { TurnstileWidget, turnstileSiteKeyConfigurada } from "@/components/turnstile-widget";
import { apiFetch } from "@/lib/api";

export function ContatoFormClient() {
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: "sucesso" | "erro"; texto: string } | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const turnstileResetRef = useRef<(() => void) | null>(null);
  const turnstileObrigatorio = turnstileSiteKeyConfigurada();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAviso(null);
    setEnviando(true);
    const form = new FormData(e.currentTarget);
    try {
      await apiFetch<{ message: string; email_enviado?: boolean }>("/api/public/contato", {
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
      setAviso({
        tipo: "sucesso",
        texto: "Sua mensagem foi enviada com sucesso!",
      });
      formRef.current?.reset();
      turnstileResetRef.current?.();
    } catch (err) {
      turnstileResetRef.current?.();
      setAviso({
        tipo: "erro",
        texto: err instanceof Error ? err.message : "Não foi possível enviar sua mensagem. Tente novamente.",
      });
    } finally {
      setEnviando(false);
      setTimeout(() => setAviso(null), 6000);
    }
  }

  const submitDesabilitado = enviando || (turnstileObrigatorio && !turnstileToken);

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="mt-6 space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
    >
      {aviso ? (
        <div
          role={aviso.tipo === "erro" ? "alert" : "status"}
          className={
            aviso.tipo === "sucesso"
              ? "rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"
              : "rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          }
        >
          {aviso.texto}
        </div>
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

      <TurnstileWidget onToken={setTurnstileToken} resetRef={turnstileResetRef} />

      <button disabled={submitDesabilitado} className="btn-success w-full" type="submit">
        {enviando ? "Enviando…" : "Enviar mensagem"}
      </button>
    </form>
  );
}