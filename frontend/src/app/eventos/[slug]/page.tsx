import type { Metadata } from "next";

import { EventoPublicClient } from "./evento-public-client";
import { typicalAgeRangeFromClassificacao } from "@/lib/evento-ficha";
import { getEventoPublicoBySlug } from "@/lib/eventos-publicos";
import { resolveEventoImagemSrc } from "@/lib/evento-imagem-url";
import { serializeJsonLdForScript } from "@/lib/json-ld-html";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const evento = await getEventoPublicoBySlug(slug);
    const desc = evento.descricao.trim().slice(0, 160);
    const img = resolveEventoImagemSrc(evento.imagem_url);
    const base = (process.env.NEXT_PUBLIC_LAN_ORIGIN || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
    return {
      title: `${evento.nome} | EventosBR`,
      description: desc || `Ingressos para ${evento.nome}`,
      alternates: { canonical: `/eventos/${evento.slug}` },
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

/** JSON-LD schema.org/Event — habilita rich results de eventos no Google. */
function buildEventoJsonLd(evento: NonNullable<Awaited<ReturnType<typeof getEventoPublicoBySlug>>>) {
  const base = (process.env.NEXT_PUBLIC_LAN_ORIGIN || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
  const img = resolveEventoImagemSrc(evento.imagem_url);
  const preco = evento.preco_compra ?? evento.preco_ingresso ?? 0;

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: evento.nome,
    description: evento.descricao?.trim().slice(0, 500) || undefined,
    startDate: evento.data_inicio,
    endDate: evento.data_fim || undefined,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    location: {
      "@type": "Place",
      name: evento.local,
      address: evento.cidade || evento.local,
    },
    image: img ? [img.startsWith("http") ? img : `${base}${img}`] : undefined,
    url: `${base}/eventos/${evento.slug}`,
    offers: {
      "@type": "Offer",
      url: `${base}/eventos/${evento.slug}`,
      priceCurrency: "BRL",
      price: preco,
      availability:
        evento.compra_disponivel === false
          ? "https://schema.org/SoldOut"
          : "https://schema.org/InStock",
    },
    // schema.org/typicalAgeRange — só se classificação etária preenchida (mesmo padrão de endDate)
    typicalAgeRange: typicalAgeRangeFromClassificacao(evento.classificacao_etaria),
  };

  return serializeJsonLdForScript(jsonLd);
}

/** JSON-LD BreadcrumbList — trilha de navegação nos resultados do Google. */
function buildBreadcrumbJsonLd(evento: { nome: string; slug: string }) {
  const base = (process.env.NEXT_PUBLIC_LAN_ORIGIN || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
  return serializeJsonLdForScript({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: base },
      { "@type": "ListItem", position: 2, name: "Eventos", item: `${base}/eventos` },
      { "@type": "ListItem", position: 3, name: evento.nome, item: `${base}/eventos/${evento.slug}` },
    ],
  });
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

  let initialEvento = null;
  try {
    initialEvento = await getEventoPublicoBySlug(slug);
  } catch {
    initialEvento = null;
  }

  return (
    <>
      {initialEvento ? (
        <>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: buildEventoJsonLd(initialEvento) }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: buildBreadcrumbJsonLd(initialEvento) }}
          />
        </>
      ) : null}
      <EventoPublicClient
        key={slug}
        slug={slug}
        initialEvento={initialEvento}
        alteracaoGuardada={alteracaoGuardada}
        ingressoRetomarId={ingressoRetomar ?? null}
      />
    </>
  );
}
