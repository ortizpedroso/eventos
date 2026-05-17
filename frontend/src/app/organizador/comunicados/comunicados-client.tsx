"use client";

import { useCallback, useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import type { Evento } from "@/lib/types";

type EventoOpcao = { evento_id: string; nome: string; publicado: boolean };

export function ComunicadosClient() {
  const [eventos, setEventos] = useState<EventoOpcao[]>([]);
  const [eventoId, setEventoId] = useState("");
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const lista = await apiFetch<Evento[]>("/api/eventos/organizador/meus", { cache: "no-store" });
        const opcoes = lista.map((e) => ({
          evento_id: e.id,
          nome: e.nome,
          publicado: e.publicado,
        }));
        setEventos(opcoes);
        if (opcoes[0]) setEventoId(opcoes[0].evento_id);
      } catch {
        setEventos([]);
      }
    })();
  }, []);

  const enviar = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!eventoId) {
        setError("Selecione um evento.");
        return;
      }
      setBusy(true);
      setError(null);
      setMsg(null);
      try {
        const r = await apiFetch<{ destinatarios: number; enfileirados: number; mensagem: string }>(
          "/api/organizador/comunicados",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              evento_id: eventoId,
              assunto: assunto.trim(),
              mensagem: mensagem.trim(),
            }),
          },
        );
        setMsg(`${r.mensagem} (${r.destinatarios} destinatário(s)).`);
        setAssunto("");
        setMensagem("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha ao enviar comunicado.");
      } finally {
        setBusy(false);
      }
    },
    [eventoId, assunto, mensagem],
  );

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">Comunicados</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Envie e-mail para participantes com ingresso <strong>pago</strong> ou já <strong>utilizado</strong>.
          Requer SMTP configurado na API.
        </p>
      </div>

      {eventos.length === 0 ? (
        <p className="text-sm text-zinc-600">Crie um evento antes de enviar comunicados.</p>
      ) : (
        <form onSubmit={(e) => void enviar(e)} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div>
            <label className="text-xs font-medium text-zinc-700" htmlFor="com_evento">
              Evento
            </label>
            <select
              id="com_evento"
              value={eventoId}
              onChange={(e) => setEventoId(e.target.value)}
              className="mt-0.5 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
            >
              {eventos.map((ev) => (
                <option key={ev.evento_id} value={ev.evento_id}>
                  {ev.nome}
                  {!ev.publicado ? " (pausado)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-700" htmlFor="com_assunto">
              Assunto
            </label>
            <input
              id="com_assunto"
              value={assunto}
              onChange={(e) => setAssunto(e.target.value)}
              className="mt-0.5 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
              maxLength={200}
              required
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-700" htmlFor="com_msg">
              Mensagem
            </label>
            <textarea
              id="com_msg"
              rows={8}
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              className="mt-0.5 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
              required
              minLength={10}
            />
          </div>
          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
          {msg ? (
            <p className="text-sm text-emerald-800" role="status">
              {msg}
            </p>
          ) : null}
          <button type="submit" disabled={busy} className="btn-primary w-full sm:w-auto">
            {busy ? "Enviando…" : "Enviar comunicado"}
          </button>
        </form>
      )}
    </div>
  );
}
