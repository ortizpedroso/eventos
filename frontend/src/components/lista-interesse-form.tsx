"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";

type Props = {
  slug: string;
};

export function ListaInteresseForm({ slug }: Props) {
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      const res = await apiFetch<{ mensagem: string }>(`/api/listas/interesse/${encodeURIComponent(slug)}`, {
        method: "POST",
        body: JSON.stringify({ email, nome: nome || null }),
      });
      setMsg(res.mensagem);
      setEmail("");
      setNome("");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Não foi possível inscrever.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
      <p className="text-sm font-medium text-amber-950">Vendas em breve — avise-me</p>
      <p className="mt-1 text-xs text-amber-900/80">Receba um e-mail quando os ingressos estiverem à venda.</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          required
          placeholder="Seu e-mail"
          value={email}
          onChange={(ev) => setEmail(ev.target.value)}
          className="input flex-1"
        />
        <input
          type="text"
          placeholder="Nome (opcional)"
          value={nome}
          onChange={(ev) => setNome(ev.target.value)}
          className="input flex-1"
        />
        <button type="submit" disabled={loading} className="btn-success shrink-0 px-4">
          {loading ? "…" : "Avisar-me"}
        </button>
      </div>
      {msg ? <p className="mt-2 text-xs text-emerald-800">{msg}</p> : null}
    </form>
  );
}
