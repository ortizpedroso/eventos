"use client";

import { useCallback, useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";

export type EventoCupom = {
  id: string;
  codigo: string;
  tipo: "percentual" | "fixo";
  valor: number;
  max_usos: number | null;
  usos: number;
  ativo: boolean;
  valido_ate: string | null;
};

type Props = {
  eventoId: string;
};

export function EventoCuponsEditor({ eventoId }: Props) {
  const [cupons, setCupons] = useState<EventoCupom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [codigo, setCodigo] = useState("");
  const [tipo, setTipo] = useState<"percentual" | "fixo">("percentual");
  const [valor, setValor] = useState("10");
  const [maxUsos, setMaxUsos] = useState("");

  const carregar = useCallback(async () => {
    setError(null);
    try {
      const rows = await apiFetch<EventoCupom[]>(`/api/eventos/id/${eventoId}/cupons`, {
        cache: "no-store",
      });
      setCupons(rows);
    } catch (e) {
      setCupons([]);
      setError(e instanceof Error ? e.message : "Não foi possível carregar cupons.");
    } finally {
      setLoading(false);
    }
  }, [eventoId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function criar() {
    setBusy(true);
    setError(null);
    if (!codigo.trim()) {
      setError("Informe o código do cupom.");
      setBusy(false);
      return;
    }
    const v = Number.parseFloat(valor.replace(",", "."));
    if (!Number.isFinite(v) || v <= 0) {
      setError("Valor do desconto inválido.");
      setBusy(false);
      return;
    }
    const payload = {
      codigo: codigo.trim().toUpperCase(),
      tipo,
      valor: tipo === "percentual" ? v / 100 : v,
      max_usos: maxUsos.trim() ? Number.parseInt(maxUsos, 10) : null,
      ativo: true,
    };
    try {
      await apiFetch(`/api/eventos/id/${eventoId}/cupons`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      setCodigo("");
      setValor(tipo === "percentual" ? "10" : "5");
      await carregar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar cupom.");
    } finally {
      setBusy(false);
    }
  }

  async function remover(id: string) {
    if (!window.confirm("Remover este cupom?")) return;
    setBusy(true);
    try {
      await apiFetch(`/api/eventos/id/${eventoId}/cupons/${id}`, { method: "DELETE" });
      await carregar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao remover.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-900">Cupons de desconto</h2>
      <p className="mt-1 text-xs text-zinc-600">
        Códigos válidos só neste evento. Percentual: use 10 para 10%. Fixo: valor em R$.
      </p>

      {loading ? <p className="mt-3 text-xs text-zinc-500">A carregar…</p> : null}
      {error ? (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <div
        className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
        onKeyDown={(e) => {
          if (e.key !== "Enter" || (e.target as HTMLElement).tagName === "BUTTON") return;
          e.preventDefault();
          e.stopPropagation();
          void criar();
        }}
      >
        <div>
          <label className="text-xs font-medium text-zinc-700" htmlFor="cupom_codigo">
            Código
          </label>
          <input
            id="cupom_codigo"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            className="mt-0.5 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm uppercase"
            maxLength={40}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-700" htmlFor="cupom_tipo">
            Tipo
          </label>
          <select
            id="cupom_tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as "percentual" | "fixo")}
            className="mt-0.5 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
          >
            <option value="percentual">Percentual (%)</option>
            <option value="fixo">Valor fixo (R$)</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-700" htmlFor="cupom_valor">
            {tipo === "percentual" ? "Percentual" : "Desconto R$"}
          </label>
          <input
            id="cupom_valor"
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="mt-0.5 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-700" htmlFor="cupom_max">
            Máx. usos
          </label>
          <input
            id="cupom_max"
            inputMode="numeric"
            value={maxUsos}
            onChange={(e) => setMaxUsos(e.target.value.replace(/\D/g, ""))}
            placeholder="Ilimitado"
            className="mt-0.5 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex items-end">
          <button
            type="button"
            disabled={busy}
            className="btn-primary w-full text-sm"
            onClick={() => void criar()}
          >
            {busy ? "…" : "Adicionar"}
          </button>
        </div>
      </div>

      {cupons.length > 0 ? (
        <ul className="mt-4 space-y-2 text-sm">
          {cupons.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-100 bg-zinc-50 px-3 py-2"
            >
              <span>
                <strong className="font-mono text-emerald-900">{c.codigo}</strong>
                {" · "}
                {c.tipo === "percentual"
                  ? `${(c.valor * 100).toFixed(0)}%`
                  : c.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                {" · "}
                {c.usos}
                {c.max_usos != null ? `/${c.max_usos}` : ""} usos
                {!c.ativo ? " · inativo" : ""}
              </span>
              <button
                type="button"
                className="text-xs text-red-700 underline"
                disabled={busy}
                onClick={() => void remover(c.id)}
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
      ) : !loading ? (
        <p className="mt-3 text-xs text-zinc-500">Nenhum cupom criado.</p>
      ) : null}
    </section>
  );
}
