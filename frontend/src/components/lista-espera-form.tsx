"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";

type Props = {
  slug: string;
};

export function ListaEsperaForm({ slug }: Props) {
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      const res = await apiFetch<{ mensagem: string; posicao: number }>(
        `/api/listas/espera/${encodeURIComponent(slug)}`,
        { method: "POST", body: JSON.stringify({ email, nome: nome || null }) },
      );
      setMsg(res.mensagem);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Não foi possível entrar na fila.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4" data-testid="lista-espera-form">
      <p className="text-sm font-medium text-zinc-900">Lista de espera</p>
      <p className="mt-1 text-xs text-zinc-600">Esgotado? Entre na fila e avisaremos por e-mail quando liberar vaga.</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          required
          placeholder="E-mail"
          value={email}
          onChange={(ev) => setEmail(ev.target.value)}
          className="input flex-1"
          data-testid="lista-espera-email"
        />
        <input type="text" placeholder="Nome" value={nome} onChange={(ev) => setNome(ev.target.value)} className="input flex-1" />
        <button type="submit" disabled={loading} data-testid="lista-espera-submit" className="btn-outline shrink-0 px-4">
          {loading ? "…" : "Entrar na fila"}
        </button>
      </div>
      {msg ? <p className="mt-2 text-xs text-emerald-800">{msg}</p> : null}
    </form>
  );
}
