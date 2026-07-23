"use client";

import { useEffect } from "react";

import { apiFetch } from "@/lib/api";
import { AUTH_SYNC_EVENT } from "@/lib/auth-sync";
import {
  ORGANIZADOR_CACHE_KEYS,
  readOrganizadorCache,
  writeOrganizadorCache,
} from "@/lib/organizador-session-cache";
import type { Evento } from "@/lib/types";

/** Pré-aquece caches do painel ao entrar — 2ª navegação e keep-alive ficam instantâneos. */
export function OrganizadorPanelBootstrap() {
  useEffect(() => {
    let cancelled = false;

    async function warm() {
      const jobs: Promise<void>[] = [];

      if (!readOrganizadorCache(ORGANIZADOR_CACHE_KEYS.eventos)) {
        jobs.push(
          apiFetch<Evento[]>("/api/eventos/meus", { cache: "no-store" })
            .then((data) => {
              if (!cancelled) writeOrganizadorCache(ORGANIZADOR_CACHE_KEYS.eventos, data);
            })
            .catch(() => undefined),
        );
      }

      if (!readOrganizadorCache(ORGANIZADOR_CACHE_KEYS.relatorios)) {
        jobs.push(
          apiFetch<unknown>("/api/relatorios/organizador?dias=90", { cache: "no-store" })
            .then((data) => {
              if (!cancelled) writeOrganizadorCache(ORGANIZADOR_CACHE_KEYS.relatorios, data);
            })
            .catch(() => undefined),
        );
      }

      if (!readOrganizadorCache(ORGANIZADOR_CACHE_KEYS.financeiro)) {
        jobs.push(
          Promise.all([
            apiFetch<unknown>("/api/relatorios/organizador?dias=90", { cache: "no-store" }),
            apiFetch<unknown>("/api/organizador/financeiro/saldo", { cache: "no-store" }),
            apiFetch<unknown>("/api/organizador/assinatura", { cache: "no-store" }),
          ])
            .then(([data, saldo, ass]) => {
              if (cancelled) return;
              const efetivo = (ass as { taxa_efetiva?: string }).taxa_efetiva || (saldo as { plano_tarifa?: string }).plano_tarifa || "padrao";
              writeOrganizadorCache(ORGANIZADOR_CACHE_KEYS.financeiro, {
                data,
                assinatura: ass,
                planoTarifa: efetivo === "assinatura" ? "assinatura" : "padrao",
              });
            })
            .catch(() => undefined),
        );
      }

      await Promise.all(jobs);
    }

    const onSync = () => void warm();
    void warm();
    window.addEventListener(AUTH_SYNC_EVENT, onSync);
    return () => {
      cancelled = true;
      window.removeEventListener(AUTH_SYNC_EVENT, onSync);
    };
  }, []);

  return null;
}
