import { cache } from "react";

import { apiFetch } from "@/lib/api";
import type { Evento } from "@/lib/types";

export type ProdutorPerfilPublico = {
  slug: string;
  nome: string;
  bio?: string | null;
  foto_url?: string | null;
  social_instagram?: string | null;
  social_whatsapp?: string | null;
  social_site?: string | null;
  brand_name?: string | null;
  brand_logo_url?: string | null;
  brand_primary_color?: string | null;
  brand_primary_color_dark?: string | null;
  metricas: { eventos_publicados: number; ingressos_pagos: number };
  eventos: Evento[];
};

export async function fetchProdutorBySlug(slug: string): Promise<ProdutorPerfilPublico> {
  return apiFetch<ProdutorPerfilPublico>(`/api/produtor/${encodeURIComponent(slug)}`, {
    cache: "no-store",
  });
}

/** Uma única chamada por request SSR (metadata + página). */
export const getProdutorPublicoBySlug = cache(fetchProdutorBySlug);
