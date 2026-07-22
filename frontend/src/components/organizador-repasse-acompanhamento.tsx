"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { StatusTrackerFromPayload } from "@/components/status-tracker";
import { useStatusPolling } from "@/hooks/use-status-polling";
import { apiFetch } from "@/lib/api";

type Acompanhamento = {
  tracking_id?: string;
  repasse_status_rotulo?: string;
  repasse_aprovado?: boolean;
  pode_reenviar_conta?: boolean;
  pode_publicar_eventos_pagos?: boolean;
  detalhes?: Record<string, string | undefined> | null;
};

export function OrganizadorRepasseAcompanhamento() {
  const searchParams = useSearchParams();
  const [trackingId, setTrackingId] = useState<string | null>(
    searchParams.get("tracking"),
  );

  useEffect(() => {
    const fromUrl = searchParams.get("tracking");
    if (fromUrl) {
      setTrackingId(fromUrl);
      return;
    }
    void apiFetch<Acompanhamento>("/api/organizador/asaas/acompanhamento", {
      cache: "no-store",
    })
      .then((r) => {
        if (r.tracking_id) setTrackingId(r.tracking_id);
      })
      .catch(() => {
        /* ignore */
      });
  }, [searchParams]);

  const pollUrl = trackingId
    ? `/api/organizador/onboarding/conta/${encodeURIComponent(trackingId)}/status`
    : null;
  const { data, error, polling } = useStatusPolling(pollUrl, { intervalMs: 4000 });

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-600">
        Carregando acompanhamento da conta de recebimento…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-zinc-900">Conta de repasses</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Acompanhe em tempo real a análise da sua conta de recebimento.
        </p>

        <div className="mt-6">
          <StatusTrackerFromPayload data={data} polling={polling} />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/organizador/financeiro" className="btn-outline px-4 py-2 text-sm">
          Voltar ao Financeiro
        </Link>
        {data.current_step === "REJECTED" ? (
          <Link
            href="/organizador/financeiro?reenviar=1"
            className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-900"
          >
            Reenviar dados para análise
          </Link>
        ) : null}
        {data.final_state === "success" ? (
          <Link href="/eventos/novo" className="btn-success px-4 py-2 text-sm">
            Criar evento
          </Link>
        ) : null}
      </div>
    </div>
  );
}
