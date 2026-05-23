"use client";

import { useCallback, useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";

type LinkPortaria = {
  evento_id: string;
  evento_nome: string;
  token: string;
  url: string;
};

export function EventoLinkPortaria({ eventoId }: { eventoId: string }) {
  const [link, setLink] = useState<LinkPortaria | null>(null);
  const [busy, setBusy] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const data = await apiFetch<LinkPortaria>(`/api/eventos/id/${eventoId}/link-portaria`);
      setLink(data);
    } catch (e) {
      setLink(null);
      setErro(e instanceof Error ? e.message : "Não foi possível obter o link.");
    }
  }, [eventoId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function copiar() {
    if (!link?.url) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2500);
    } catch {
      setErro("Não foi possível copiar. Selecione o link manualmente.");
    }
  }

  async function regenerar() {
    if (!window.confirm("O link antigo deixa de funcionar. Gerar um novo link da portaria?")) {
      return;
    }
    setBusy(true);
    setErro(null);
    try {
      const data = await apiFetch<LinkPortaria>(
        `/api/eventos/id/${eventoId}/link-portaria/regenerar`,
        { method: "POST" },
      );
      setLink(data);
      setCopiado(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível regenerar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50/90 px-3 py-2.5 text-xs leading-relaxed text-sky-950">
      <p className="font-semibold text-sky-900">Link da portaria (colaboradores)</p>
      <p className="mt-1 text-sky-900/90">
        Envie para quem valida na entrada. Funciona sem login — câmera, leitor USB ou digitação.
      </p>
      {erro ? <p className="mt-2 text-red-800">{erro}</p> : null}
      {link ? (
        <div className="mt-2 space-y-2">
          <input
            type="text"
            readOnly
            value={link.url}
            className="w-full rounded-md border border-sky-200 bg-white px-2 py-1.5 font-mono text-[11px] text-zinc-800"
            onFocus={(e) => e.target.select()}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void copiar()}
              className="rounded-md bg-sky-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-sky-800"
            >
              {copiado ? "Copiado!" : "Copiar link"}
            </button>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-sky-300 bg-white px-2.5 py-1.5 text-xs font-medium text-sky-900 hover:bg-sky-100"
            >
              Abrir portaria
            </a>
            <button
              type="button"
              disabled={busy}
              onClick={() => void regenerar()}
              className="rounded-md border border-sky-300 px-2.5 py-1.5 text-xs text-sky-900 hover:bg-sky-100 disabled:opacity-60"
            >
              {busy ? "…" : "Novo link"}
            </button>
          </div>
        </div>
      ) : !erro ? (
        <p className="mt-2 text-sky-800/80">A carregar link…</p>
      ) : null}
    </div>
  );
}
