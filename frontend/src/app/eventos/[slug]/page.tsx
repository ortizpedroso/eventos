import { Suspense } from "react";
import type { Metadata } from "next";

import { EventoPublicClient } from "./evento-public-client";
import { fetchEventoBySlug } from "@/lib/eventos-publicos";
import { resolveEventoImagemSrc } from "@/lib/evento-imagem-url";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const evento = await fetchEventoBySlug(slug);
    const desc = evento.descricao.trim().slice(0, 160);
    const img = resolveEventoImagemSrc(evento.imagem_url);
    const base = (process.env.NEXT_PUBLIC_LAN_ORIGIN || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
    return {
      title: `${evento.nome} | EventosBR`,
      description: desc || `Ingressos para ${evento.nome}`,
      openGraph: {
        title: evento.nome,
        description: desc || undefined,
        type: "website",
        url: `${base}/eventos/${evento.slug}`,
        ...(img ? { images: [{ url: img.startsWith("http") ? img : `${base}${img}` }] } : {}),
      },
    };
  } catch {
    return { title: "Evento | EventosBR" };
  }
}

export default async function EventoPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ atualizado?: string | string[]; retomar?: string | string[] }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const raw = sp?.atualizado;
  const alteracaoGuardada =
    raw === "1" || (Array.isArray(raw) && raw.includes("1"));
  const rawRetomar = sp?.retomar;
  const ingressoRetomar =
    typeof rawRetomar === "string"
      ? rawRetomar
      : Array.isArray(rawRetomar)
        ? rawRetomar[0]
        : undefined;
  return (
    <Suspense
      fallback={
        <div className="space-y-4 py-8 text-sm text-zinc-600">Carregando evento…</div>
      }
    >
      <EventoPublicClient
        slug={slug}
        alteracaoGuardada={alteracaoGuardada}
        ingressoRetomarId={ingressoRetomar ?? null}
      />
    </Suspense>
  );
}
