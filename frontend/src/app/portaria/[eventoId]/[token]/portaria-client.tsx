"use client";

import { useEffect, useState } from "react";

import { CheckinPortariaClient } from "@/components/checkin-portaria-client";
import { apiFetch } from "@/lib/api";

type EventoInfo = {
  evento_id: string;
  nome: string;
  local: string;
  data_inicio: string;
};

export function PortariaClient({ eventoId, token }: { eventoId: string; token: string }) {
  const [info, setInfo] = useState<EventoInfo | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!token.trim()) {
      setErro("Link incompleto. Peça ao organizador o link completo da portaria.");
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const q = new URLSearchParams({ evento_id: eventoId, k: token.trim() });
        const data = await apiFetch<EventoInfo>(`/api/portaria/evento?${q.toString()}`);
        if (!cancelled) {
          setInfo(data);
          setErro(null);
        }
      } catch (e) {
        if (!cancelled) {
          setInfo(null);
          setErro(e instanceof Error ? e.message : "Link inválido.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventoId, token]);

  if (!token.trim() || erro) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-zinc-900">Portaria — acesso negado</h1>
        <p className="mt-4 text-sm text-zinc-600">{erro ?? "Token em falta."}</p>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-zinc-500">
        A carregar evento…
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-zinc-50 px-4 py-8 sm:py-10">
      <CheckinPortariaClient
        modo="portaria"
        eventoId={eventoId}
        token={token.trim()}
        tituloEvento={info.nome}
      />
    </div>
  );
}
