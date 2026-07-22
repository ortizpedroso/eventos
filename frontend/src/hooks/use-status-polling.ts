"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { apiFetch } from "@/lib/api";

export type TrackerStep = { key: string; label: string };

export type TrackerPayload = {
  status: string;
  reasons?: string[];
  final?: boolean;
  final_state?: "success" | "error" | null;
  titulo_final?: string | null;
  mensagem_final?: string | null;
  steps: TrackerStep[];
  current_step: string;
  mostrar_motivos_na_tela?: boolean;
};

type Options = {
  enabled?: boolean;
  intervalMs?: number;
  maxErrors?: number;
};

export function useStatusPolling(
  url: string | null,
  { enabled = true, intervalMs = 4000, maxErrors = 5 }: Options = {},
) {
  const [data, setData] = useState<TrackerPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const errorsRef = useRef(0);

  const carregar = useCallback(async () => {
    if (!url || !enabled) return;
    setPolling(true);
    try {
      const r = await apiFetch<TrackerPayload>(url, { cache: "no-store" });
      setData(r);
      setError(null);
      errorsRef.current = 0;
      return r;
    } catch (e) {
      errorsRef.current += 1;
      if (errorsRef.current >= maxErrors) {
        setError(
          e instanceof Error
            ? e.message
            : "Não foi possível verificar o status no momento. Tente novamente.",
        );
      }
      return null;
    } finally {
      setPolling(false);
    }
  }, [url, enabled, maxErrors]);

  useEffect(() => {
    if (!url || !enabled) return;
    void carregar();
    const id = window.setInterval(() => {
      void carregar().then((r) => {
        if (r?.final) {
          window.clearInterval(id);
        }
      });
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [url, enabled, intervalMs, carregar]);

  return { data, error, polling, recarregar: carregar };
}
