"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ContinuarPagamentoLink } from "@/components/continuar-pagamento-link";
import { ListaSkeleton } from "@/components/lista-skeleton";
import { PerfilTabs } from "@/components/perfil-tabs";
import { apiFetch } from "@/lib/api";
import { urlPosCompraEvento } from "@/lib/checkout-return";
import { classeBadgeStatus, labelStatusIngresso } from "@/lib/ingresso-status";
import type { PagamentoListItem } from "@/lib/types";

export function PagamentosClient() {
  const router = useRouter();
  const pathname = usePathname();
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

  useEffect(() => {
    if (ok !== "1" || !ingressoParam || !destaque?.evento.slug) return;
    router.replace(urlPosCompraEvento(destaque.evento.slug, ingressoParam));
  }, [ok, ingressoParam, destaque?.evento.slug, router]);

  async function cancelar(ingressoId: string) {
    const ok = window.confirm(
      "Deseja cancelar este ingresso e solicitar reembolso? Esta ação não pode ser desfeita.",
    );
    if (!ok) return;
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

  const pendentes = useMemo(
    () => (items ?? []).filter((i) => i.status === "pendente" && i.reservado_ate),
    [items],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Meus pagamentos</h1>
        <Link href="/eventos" className="text-sm text-zinc-600 hover:underline">
          ← Eventos
        </Link>
      </div>

      {pathname.startsWith("/organizador") ? <PerfilTabs base="/organizador/perfil" /> : null}

      {pendentes.length > 0 ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 shadow-sm">
          <p className="font-semibold text-amber-950">
            {pendentes.length === 1
              ? "Você tem 1 pagamento pendente"
              : `Você tem ${pendentes.length} pagamentos pendentes`}
          </p>
          <p className="mt-1 text-sm text-amber-900">
            Conclua antes que a reserva expire — o ingresso não fica garantido após o prazo.
          </p>
          <ul className="mt-3 space-y-2">
            {pendentes.map((it) => (
              <li
                key={it.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"
              >
                <span className="font-medium text-zinc-900">{it.evento.nome}</span>
                <ContinuarPagamentoLink
                  ingressoId={it.id}
                  eventoSlug={it.evento.slug}
                  reservadoAte={it.reservado_ate}
                  status={it.status}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {ok && ingressoParam && destaque?.evento.slug ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          Pagamento confirmado! Redirecionando para seu ingresso…
        </div>
      ) : null}

      {ok && (!ingressoParam || !destaque?.evento.slug) ? (
        <div className="space-y-3">
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            Pagamento recebido! Seu ingresso será confirmado em instantes.{" "}
            {ingressoParam ? (
              <Link href={`/conta/ingressos/${ingressoParam}`} className="font-medium underline">
                Ver ingresso e QR Code
              </Link>
            ) : (
              <Link href="/conta/ingressos" className="font-medium underline">
                Ver meus ingressos
              </Link>
            )}
            .
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

      {items === null && !error ? <ListaSkeleton linhas={4} /> : null}

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
                {new Date(it.evento.data).toLocaleString("pt-BR")} • {it.evento.local}
              </div>
              {it.participante_nome ? (
                <div className="mt-2 text-xs text-zinc-600">
                  <span className="font-medium text-zinc-800">Participante: </span>
                  {it.participante_nome}
                  {it.participante_email ? ` (${it.participante_email})` : ""}
                </div>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-zinc-500">
                  Valor:{" "}
                  {it.valor.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 font-medium ${classeBadgeStatus(it.status)}`}
                >
                  {labelStatusIngresso(it.status)}
                </span>
                <span className="text-zinc-500">
                  Prazo reembolso:{" "}
                  {new Date(it.data_limite_cancelamento).toLocaleDateString("pt-BR")}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <ContinuarPagamentoLink
                  ingressoId={it.id}
                  eventoSlug={it.evento.slug}
                  reservadoAte={it.reservado_ate}
                  status={it.status}
                />
                {it.status === "pago" ? (
                  <button
                    type="button"
                    onClick={() => void cancelar(it.id)}
                    className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-100"
                  >
                    Cancelar e reembolsar
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
