"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { ListaSkeleton } from "@/components/lista-skeleton";
import { PerfilTabs } from "@/components/perfil-tabs";
import { apiFetch } from "@/lib/api";
import type { NotificacaoUsuario } from "@/lib/types";

export function NotificacoesClient() {
  const pathname = usePathname();
  const [items, setItems] = useState<NotificacaoUsuario[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await apiFetch<NotificacaoUsuario[]>("/api/notificacoes", {
        cache: "no-store",
      });
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar notificações");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function marcarLida(id: string) {
    try {
      await apiFetch(`/api/notificacoes/${id}/lida`, { method: "POST" });
      setItems((prev) =>
        prev?.map((n) => (n.id === id ? { ...n, lida: true } : n)) ?? prev,
      );
    } catch {
      // ignore — usuário pode tentar de novo
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-zinc-900">Notificações</h1>

      {pathname.startsWith("/organizador") ? <PerfilTabs base="/organizador/perfil" /> : null}

      <p className="mt-2 text-sm text-zinc-600">
        Avisos sobre compras, lista de espera e atualizações da sua conta.
      </p>

      {error ? (
        <p className="mt-6 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {items === null ? (
        <div className="mt-6">
          <ListaSkeleton linhas={4} />
        </div>
      ) : items.length === 0 ? (
        <p className="mt-8 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-6 text-sm text-zinc-600">
          Nenhuma notificação por enquanto.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((n) => (
            <li
              key={n.id}
              className={`rounded-lg border px-4 py-3 text-sm ${
                n.lida
                  ? "border-zinc-200 bg-white text-zinc-600"
                  : "border-emerald-200 bg-emerald-50/50 text-zinc-900"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{n.titulo}</p>
                  <p className="mt-1 leading-relaxed">{n.mensagem}</p>
                  {n.link ? (
                    <Link
                      href={n.link}
                      className="mt-2 inline-block text-xs font-medium text-emerald-800 underline"
                    >
                      Ver detalhes
                    </Link>
                  ) : null}
                </div>
                {!n.lida ? (
                  <button
                    type="button"
                    onClick={() => void marcarLida(n.id)}
                    className="shrink-0 text-xs font-medium text-emerald-800 underline"
                  >
                    Marcar como lida
                  </button>
                ) : null}
              </div>
              {n.data_criacao ? (
                <p className="mt-2 text-[11px] text-zinc-500">
                  {new Date(n.data_criacao).toLocaleString("pt-BR")}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
