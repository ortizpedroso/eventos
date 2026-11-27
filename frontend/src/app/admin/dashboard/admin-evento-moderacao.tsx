"use client";

import { useState } from "react";

import { adminFetch } from "@/lib/admin-api";

export const MOTIVOS_SUSPENSAO = [
  { valor: "ofensivo", rotulo: "Conteúdo ofensivo ou discriminatório" },
  { valor: "ilegal", rotulo: "Conteúdo ou atividade em desacordo com a lei" },
  { valor: "falso", rotulo: "Evento falso ou informações enganosas" },
  { valor: "incompleto", rotulo: "Informações essenciais incompletas" },
  { valor: "outro", rotulo: "Violação dos Termos de Uso" },
] as const;

type Props = {
  eventoId: string;
  eventoNome: string;
  suspenso: boolean;
  busy: boolean;
  onConcluido: (mensagem: string) => Promise<void> | void;
  onErro: (mensagem: string) => void;
};

export function AdminEventoModeracao({ eventoId, eventoNome, suspenso, busy, onConcluido, onErro }: Props) {
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState<string>(MOTIVOS_SUSPENSAO[0].valor);
  const [detalhe, setDetalhe] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(caminho: string, corpo?: object) {
    setEnviando(true);
    try {
      const r = await adminFetch<{ email_enviado: boolean }>(`/api/admin/eventos/${eventoId}/${caminho}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(corpo ?? {}),
      });
      const aviso = r.email_enviado ? "Organizador avisado por e-mail." : "Não foi possível enviar o e-mail ao organizador.";
      setAberto(false);
      setDetalhe("");
      await onConcluido(`${caminho === "suspender" ? "Evento suspenso." : "Suspensão retirada."} ${aviso}`);
    } catch (e) {
      onErro(e instanceof Error ? e.message : "Falha na moderação do evento");
    } finally {
      setEnviando(false);
    }
  }

  if (suspenso) {
    return (
      <button
        type="button"
        className="text-emerald-700 underline"
        disabled={busy || enviando}
        onClick={() => {
          if (window.confirm(`Retirar a suspensão de "${eventoNome}"? Ele continua pausado até o organizador publicar.`)) {
            void enviar("reativar");
          }
        }}
      >
        Retirar suspensão
      </button>
    );
  }

  if (!aberto) {
    return (
      <button type="button" className="text-red-700 underline" disabled={busy} onClick={() => setAberto(true)}>
        Suspender
      </button>
    );
  }

  const detalheValido = detalhe.trim().length >= 10;
  return (
    <div className="mt-2 grid gap-2 rounded-md border border-red-200 bg-red-50 p-2" data-admin-suspender-form>
      <label className="grid gap-1">
        <span className="text-zinc-600">Motivo</span>
        <select value={motivo} onChange={(e) => setMotivo(e.target.value)} className="rounded border border-zinc-300 px-2 py-1">
          {MOTIVOS_SUSPENSAO.map((m) => (
            <option key={m.valor} value={m.valor}>
              {m.rotulo}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1">
        <span className="text-zinc-600">Explicação para o organizador (vai no e-mail)</span>
        <textarea
          value={detalhe}
          onChange={(e) => setDetalhe(e.target.value)}
          rows={3}
          maxLength={2000}
          className="rounded border border-zinc-300 px-2 py-1"
          placeholder="Ex.: a imagem de capa contém conteúdo ofensivo."
        />
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          className="rounded bg-red-700 px-3 py-1 text-white disabled:opacity-50"
          disabled={!detalheValido || enviando}
          onClick={() => void enviar("suspender", { motivo, detalhe: detalhe.trim() })}
        >
          {enviando ? "Suspendendo…" : "Confirmar suspensão"}
        </button>
        <button type="button" className="rounded border border-zinc-300 px-3 py-1" onClick={() => setAberto(false)}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
