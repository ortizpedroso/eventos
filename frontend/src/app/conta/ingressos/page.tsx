"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import type { IngressoListItem } from "@/lib/types";

export default function MeusIngressosPage() {
  const [items, setItems] = useState<IngressoListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<IngressoListItem[]>("/api/ingressos/meus", {
          cache: "no-store",
        });
        if (!cancelled) setItems(data);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Não foi possível carregar ingressos",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Meus ingressos</h1>
        <Link href="/eventos" className="text-sm text-zinc-600 hover:underline">
          ← Eventos
        </Link>
      </div>

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
        <p className="text-sm text-zinc-600">Nenhum ingresso ainda.</p>
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
                {new Date(it.evento.data).toLocaleString("pt-BR")} • {it.evento.local}
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
                  Compra: {new Date(it.data_compra).toLocaleString("pt-BR")}
                </span>
              </div>
              <div className="mt-3">
                <Link
                  href={`/conta/ingressos/${it.id}`}
                  className="text-sm font-medium text-emerald-800 underline-offset-2 hover:underline"
                >
                  Opções do ingresso (PDF / e-mail) →
                </Link>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
