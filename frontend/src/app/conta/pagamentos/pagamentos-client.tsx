"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { apiFetch } from "@/lib/api";
import type { PagamentoListItem } from "@/lib/types";

export function PagamentosClient() {
  const searchParams = useSearchParams();
  const ok = searchParams.get("ok");
  const ingressoParam = searchParams.get("ingresso");

  const [items, setItems] = useState<PagamentoListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelMsg, setCancelMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await apiFetch<PagamentoListItem[]>("/api/pagamentos/meus", {
        cache: "no-store",
      });
      setItems(data);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível carregar pagamentos",
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const destaque = useMemo(
    () =>
      items && ingressoParam
        ? items.find((i) => i.id === ingressoParam)
        : undefined,
    [items, ingressoParam],
  );

  async function cancelar(ingressoId: string) {
    setCancelMsg(null);
    try {
      await apiFetch("/api/pagamentos/cancelar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ingresso_id: ingressoId }),
      });
      setCancelMsg("Cancelamento solicitado com sucesso.");
      await load();
    } catch (e) {
      setCancelMsg(
        e instanceof Error ? e.message : "Não foi possível cancelar",
      );
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Meus pagamentos</h1>
        <Link href="/" className="text-sm text-zinc-600 hover:underline">
          ← Eventos
        </Link>
      </div>

      {ok ? (
        <div className="space-y-3">
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            Pagamento concluído. Se o status ainda aparecer como pendente, aguarde
            o webhook do Stripe ou atualize a página.
          </div>
          {destaque?.evento.mensagem_confirmacao ? (
            <div className="rounded-md border border-emerald-600 bg-white p-4 text-sm shadow-sm ring-1 ring-emerald-600">
              <p className="font-semibold text-emerald-800">Confirmação de inscrição</p>
              <p className="mt-2 whitespace-pre-line text-zinc-800">
                {destaque.evento.mensagem_confirmacao}
              </p>
              {destaque.participante_nome ? (
                <p className="mt-3 text-xs text-zinc-600">
                  <span className="font-medium text-zinc-700">Participante: </span>
                  {destaque.participante_nome}
                  {destaque.participante_email ? (
                    <span> ({destaque.participante_email})</span>
                  ) : null}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {cancelMsg ? (
        <div className="rounded-md border border-zinc-200 bg-white p-3 text-sm text-zinc-800">
          {cancelMsg}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
          <div className="mt-2">
            <Link href="/auth" className="underline">
              Fazer login
            </Link>
          </div>
        </div>
      ) : null}

      {items && !items.length ? (
        <p className="text-sm text-zinc-600">Nenhum pagamento ainda.</p>
      ) : null}

      {items && items.length > 0 ? (
        <ul className="space-y-3">
          {items.map((it) => (
            <li
              key={it.id}
              className="rounded-lg border bg-white p-4 text-sm shadow-sm"
            >
              <div className="font-medium">{it.evento.nome}</div>
              <div className="mt-1 text-zinc-600">
                {new Date(it.evento.data).toLocaleString("pt-BR")} até{" "}
                {new Date(it.evento.data_fim).toLocaleString("pt-BR")} •{" "}
                {it.evento.local}
              </div>
              {it.participante_nome ? (
                <div className="mt-2 text-xs text-zinc-600">
                  <span className="font-medium text-zinc-800">Participante: </span>
                  {it.participante_nome}
                  {it.participante_email ? ` (${it.participante_email})` : ""}
                </div>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-500">
                <span>
                  Valor:{" "}
                  {it.valor.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </span>
                <span>Status: {it.status}</span>
                <span>
                  Limite cancel.:{" "}
                  {new Date(it.data_limite_cancelamento).toLocaleString("pt-BR")}
                </span>
              </div>
              {it.status === "pago" ? (
                <button
                  type="button"
                  onClick={() => void cancelar(it.id)}
                  className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-100"
                >
                  Cancelar e reembolsar
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
