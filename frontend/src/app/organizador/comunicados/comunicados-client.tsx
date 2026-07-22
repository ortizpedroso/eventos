"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { apiFetch } from "@/lib/api";

type EventoOpcao = {
  evento_id: string;
  nome: string;
  publicado: boolean;
  data_inicio: string | null;
  destinatarios: number;
};

function formatarDataEvento(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export function ComunicadosClient() {
  const [eventos, setEventos] = useState<EventoOpcao[]>([]);
  const [busca, setBusca] = useState("");
  const [eventoId, setEventoId] = useState("");
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [busy, setBusy] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const carregarEventos = useCallback(async (termo: string) => {
    setCarregando(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "30" });
      const q = termo.trim();
      if (q) params.set("q", q);
      const lista = await apiFetch<EventoOpcao[]>(
        `/api/organizador/comunicados/eventos?${params.toString()}`,
        { cache: "no-store" },
      );
      setEventos(lista);
      setEventoId((atual) => {
        if (atual && lista.some((e) => e.evento_id === atual)) return atual;
        return lista[0]?.evento_id ?? "";
      });
    } catch (err) {
      setEventos([]);
      setEventoId("");
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível carregar os eventos. Tente novamente.",
      );
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void carregarEventos(busca);
    }, 300);
    return () => window.clearTimeout(id);
  }, [busca, carregarEventos]);

  const eventoSelecionado = useMemo(
    () => eventos.find((e) => e.evento_id === eventoId) ?? null,
    [eventos, eventoId],
  );

  const enviar = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!eventoId) {
        setError("Selecione um evento com participantes.");
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
        setMsg(`${r.mensagem} ${r.destinatarios} destinatário(s) na fila de envio.`);
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
          Envie um <strong>aviso excepcional</strong> por e-mail para quem já comprou ingresso
          (pago ou utilizado) no evento escolhido — por exemplo mudança de horário, local ou
          instruções de entrada.
        </p>
        <p className="mt-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950">
          Os ingressos <strong>não são entregues por aqui</strong>. Após a compra, cada participante
          já encontra o ingresso com QR Code em <strong>Minha conta → Ingressos</strong>.
        </p>
      </div>

      {carregando && eventos.length === 0 ? (
        <p className="text-sm text-zinc-600">Carregando eventos com participantes…</p>
      ) : error && eventos.length === 0 ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : eventos.length === 0 ? (
        <p className="text-sm text-zinc-600">
          Nenhum evento com participantes elegíveis ainda. Quando houver vendas confirmadas, o
          evento aparecerá aqui para você enviar avisos.{" "}
          <Link href="/organizador/eventos" className="font-medium text-emerald-800 underline-offset-2 hover:underline">
            Ver meus eventos
          </Link>
        </p>
      ) : (
        <form onSubmit={(e) => void enviar(e)} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div>
            <label className="text-xs font-medium text-zinc-700" htmlFor="com_busca">
              Buscar evento
            </label>
            <input
              id="com_busca"
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Digite o nome do evento…"
              className="mt-0.5 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
              autoComplete="off"
            />
            <p className="mt-1 text-xs text-zinc-500">
              Mostrando até 30 eventos com vendas confirmadas. Use a busca se você tiver muitos
              eventos.
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-700" htmlFor="com_evento">
              Evento
            </label>
            <select
              id="com_evento"
              value={eventoId}
              onChange={(e) => setEventoId(e.target.value)}
              className="mt-0.5 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
              disabled={carregando}
            >
              {eventos.map((ev) => {
                const data = formatarDataEvento(ev.data_inicio);
                const meta = [
                  data,
                  `${ev.destinatarios} participante(s)`,
                  !ev.publicado ? "pausado" : null,
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <option key={ev.evento_id} value={ev.evento_id}>
                    {ev.nome}
                    {meta ? ` — ${meta}` : ""}
                  </option>
                );
              })}
            </select>
            {eventoSelecionado ? (
              <p className="mt-1 text-xs text-zinc-500">
                Este comunicado será enviado para{" "}
                <strong>{eventoSelecionado.destinatarios}</strong> e-mail(s) únicos com ingresso
                pago ou utilizado.
              </p>
            ) : null}
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
              placeholder="Ex.: Alteração de horário do evento"
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
              placeholder="Escreva o aviso para os participantes…"
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
          <button type="submit" disabled={busy || carregando || !eventoId} className="btn-primary w-full sm:w-auto">
            {busy ? "Enviando…" : "Enviar comunicado"}
          </button>
        </form>
      )}
    </div>
  );
}
