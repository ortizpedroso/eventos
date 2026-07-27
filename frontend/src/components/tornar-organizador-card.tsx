"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { apiFetch } from "@/lib/api";
import { onlyDigits } from "@/lib/cpf";
import { formatTelefoneBrMask } from "@/lib/telefone-br";

type Props = {
  telefoneAtual: string | null;
  autoAbrir?: boolean;
};

export function TornarOrganizadorCard({ telefoneAtual, autoAbrir = false }: Props) {
  const router = useRouter();
  const [aberto, setAberto] = useState(autoAbrir);
  const [telefone, setTelefone] = useState(telefoneAtual ? onlyDigits(telefoneAtual, 13) : "");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar() {
    setErro(null);
    setEnviando(true);
    try {
      await apiFetch("/api/auth/tornar-organizador", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ telefone }),
      });
      router.replace("/organizador/eventos");
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível concluir. Tente novamente.");
      setEnviando(false);
    }
  }

  if (!aberto) {
    return (
      <section className="max-w-lg rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-emerald-950">Crie o seu próprio evento</h2>
        <p className="mt-1.5 text-sm text-emerald-900">
          Quer vender ingressos para um show, festa ou evento seu? Transforme sua conta em uma
          conta de organizador — seu histórico de compras como cliente continua intacto.
        </p>
        <button type="button" onClick={() => setAberto(true)} className="btn-success mt-4">
          Tornar-me organizador
        </button>
      </section>
    );
  }

  return (
    <section className="max-w-lg rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm sm:p-8">
      <h2 className="text-lg font-semibold text-emerald-950">Tornar-me organizador</h2>
      {autoAbrir ? (
        <p className="mt-1.5 rounded-md bg-white/70 px-3 py-2 text-sm text-emerald-900">
          Pra criar e publicar eventos, sua conta precisa virar organizador — é rápido, só
          confirme o telefone abaixo.
        </p>
      ) : null}
      <p className="mt-1.5 text-sm text-emerald-900">
        Confirme um telefone de contato — vamos usá-lo para falar com você sobre seus eventos.
      </p>
      <div className="mt-4 grid gap-2">
        <label className="text-sm font-medium text-emerald-950" htmlFor="telefone_organizador">
          Telefone
        </label>
        <input
          id="telefone_organizador"
          inputMode="tel"
          value={formatTelefoneBrMask(telefone)}
          onChange={(e) => setTelefone(onlyDigits(e.target.value, 13))}
          placeholder="(11) 99999-9999"
          className="h-10 rounded-md border border-emerald-300 bg-white px-3 text-sm focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700"
        />
      </div>
      {erro ? (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700" role="alert">
          {erro}
        </p>
      ) : null}
      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={() => setAberto(false)}
          disabled={enviando}
          className="rounded-full border border-emerald-300 px-4 py-2 text-sm font-medium text-emerald-900 hover:bg-white"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => void confirmar()}
          disabled={enviando || telefone.replace(/\D/g, "").length < 10}
          className="btn-success px-6"
        >
          {enviando ? "Confirmando…" : "Confirmar"}
        </button>
      </div>
    </section>
  );
}
