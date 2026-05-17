"use client";

import { FormEvent, useRef, useState } from "react";

import { apiFetch } from "@/lib/api";

type CheckinResult = {
  ok: boolean;
  ja_utilizado: boolean;
  ingresso_id: string;
  participante_nome: string | null;
  evento_nome: string;
  checkin_em: string | null;
  mensagem: string;
};

export function CheckinClient() {
  const [codigo, setCodigo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<CheckinResult | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  async function validar(e?: FormEvent) {
    e?.preventDefault();
    const raw = codigo.trim();
    if (!raw) {
      setError("Cole ou digite o código do QR.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await apiFetch<CheckinResult>("/api/checkin/validar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ codigo: raw }),
      });
      setLast(r);
      setCodigo("");
      inputRef.current?.focus();
    } catch (err) {
      setLast(null);
      setError(err instanceof Error ? err.message : "Não foi possível validar o ingresso.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
          Check-in na portaria
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600">
          Leia o QR do ingresso ou cole o código <strong className="text-zinc-800">EBR1:…</strong>{" "}
          impresso no e-mail. Só ingressos pagos dos seus eventos são aceitos.
        </p>
      </header>

      <form
        onSubmit={(ev) => void validar(ev)}
        className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm ring-1 ring-emerald-200/60 sm:p-6"
      >
        <label htmlFor="checkin-codigo" className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
          Código do ingresso
        </label>
        <textarea
          id="checkin-codigo"
          ref={inputRef}
          rows={3}
          className="mt-2 w-full rounded-lg border border-emerald-200 px-3 py-2 font-mono text-sm text-zinc-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
          placeholder="EBR1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:assinatura"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          autoComplete="off"
        />
        {error ? (
          <p className="mt-3 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy}
          className="mt-4 h-11 w-full rounded-lg bg-emerald-700 text-sm font-medium text-white shadow-sm hover:bg-emerald-800 disabled:opacity-60 sm:w-auto sm:px-8"
        >
          {busy ? "Validando…" : "Validar entrada"}
        </button>
      </form>

      {last ? (
        <aside
          className={`rounded-2xl border p-5 sm:p-6 ${
            last.ja_utilizado
              ? "border-amber-200 bg-amber-50"
              : "border-emerald-200 bg-emerald-50"
          }`}
          role="status"
        >
          <p className="text-lg font-semibold text-zinc-900">{last.mensagem}</p>
          <ul className="mt-3 space-y-1 text-sm text-zinc-700">
            <li>
              <span className="font-medium">Participante:</span> {last.participante_nome || "—"}
            </li>
            <li>
              <span className="font-medium">Evento:</span> {last.evento_nome}
            </li>
            {last.checkin_em ? (
              <li>
                <span className="font-medium">Horário:</span>{" "}
                {new Date(last.checkin_em).toLocaleString("pt-BR")}
              </li>
            ) : null}
          </ul>
        </aside>
      ) : null}
    </div>
  );
}
