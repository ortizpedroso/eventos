"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { EventoCompartilhar } from "@/components/evento-compartilhar";
import { apiFetch } from "@/lib/api";

type PromoterRow = {
  id: string;
  codigo: string;
  rotulo: string | null;
  ativo: boolean;
  vendas: number;
  receita_bruta: number;
};

type Props = {
  eventoId: string;
  eventoSlug: string;
  eventoNome: string;
};

export function EventoPromotersPainel({ eventoId, eventoSlug, eventoNome }: Props) {
  const [rows, setRows] = useState<PromoterRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [rotulo, setRotulo] = useState("");
  const [codigo, setCodigo] = useState("");
  const [busy, setBusy] = useState(false);

  const origin = useMemo(() => {
    if (typeof window === "undefined") return "https://eventosbr.app.br";
    return window.location.origin;
  }, []);

  const carregar = useCallback(async () => {
    setErr(null);
    try {
      const data = await apiFetch<{ promoters: PromoterRow[] }>(
        `/api/eventos/id/${eventoId}/promoters`,
      );
      setRows(data.promoters || []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao carregar divulgadores");
    }
  }, [eventoId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const criar = async () => {
    setBusy(true);
    setErr(null);
    try {
      await apiFetch(`/api/eventos/id/${eventoId}/promoters`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          codigo: codigo.trim() || null,
          rotulo: rotulo.trim() || null,
        }),
      });
      setCodigo("");
      setRotulo("");
      await carregar();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Não foi possível criar o link");
    } finally {
      setBusy(false);
    }
  };

  const toggleAtivo = async (p: PromoterRow) => {
    setBusy(true);
    try {
      await apiFetch(`/api/eventos/id/${eventoId}/promoters/${p.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ativo: !p.ativo }),
      });
      await carregar();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao atualizar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-4 rounded-xl border border-zinc-200 bg-zinc-50/80 p-4">
      <div>
        <h2 className="text-base font-semibold text-zinc-900">Divulgadores</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Gere um link único por pessoa. Você vê quantas vendas cada link gerou — sem comissão
          automática nesta fase e sem dados pessoais do comprador.
        </p>
      </div>

      {err ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>
      ) : null}

      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-zinc-700">Rótulo (opcional)</span>
          <input
            value={rotulo}
            onChange={(e) => setRotulo(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2"
            placeholder="Ex.: Influencer Ana"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-zinc-700">Código (opcional)</span>
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2"
            placeholder="auto"
          />
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => void criar()}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          Gerar link
        </button>
      </div>

      <ul className="space-y-3">
        {rows.map((p) => {
          const shareUrl = `${origin}/eventos/${eventoSlug}?ref=${encodeURIComponent(p.codigo)}`;
          return (
            <li key={p.id} className="rounded-lg border border-zinc-200 bg-white p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-zinc-900">
                    {p.rotulo || p.codigo}{" "}
                    <span className="text-xs font-normal text-zinc-500">(?ref={p.codigo})</span>
                  </p>
                  <p className="mt-1 text-sm text-zinc-600">
                    {p.vendas} venda{p.vendas === 1 ? "" : "s"}
                    {p.receita_bruta > 0
                      ? ` · ${p.receita_bruta.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
                      : ""}
                    {!p.ativo ? " · inativo" : ""}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void toggleAtivo(p)}
                  className="text-sm text-zinc-600 underline hover:text-zinc-900"
                >
                  {p.ativo ? "Desativar" : "Ativar"}
                </button>
              </div>
              {p.ativo ? (
                <EventoCompartilhar nome={eventoNome} shareUrl={shareUrl} className="mt-3" />
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
