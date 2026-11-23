import { headers } from "next/headers";
import { cache } from "react";

import { VITRINE_HOST_HEADER, fetchVitrinePorHost, type VitrineProdutor } from "@/lib/organizer-tenant";

/** Vitrine da requisição atual; null no site da plataforma. */
export const getVitrine = cache(async (): Promise<VitrineProdutor | null> => {
  const host = (await headers()).get(VITRINE_HOST_HEADER);
  return host ? fetchVitrinePorHost(host) : null;
});

export function urlNaVitrine(vitrine: VitrineProdutor, path: string): string {
  return `https://${vitrine.host}${path}`;
}
