import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProdutorPublicClient } from "./produtor-public-client";
import { resolveEventoImagemSrc } from "@/lib/evento-imagem-url";
import { getProdutorPublicoBySlug } from "@/lib/produtor-publico";
import { buildProdutorJsonLd } from "@/lib/public-json-ld";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const perfil = await getProdutorPublicoBySlug(slug);
    const nome = perfil.brand_name?.trim() || perfil.nome;
    const desc =
      (perfil.bio || "").trim().slice(0, 160) ||
      `Eventos e ingressos de ${nome} na EventosBR.`;
    const img = resolveEventoImagemSrc(perfil.foto_url || perfil.brand_logo_url);
    const base = (
      process.env.NEXT_PUBLIC_LAN_ORIGIN ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "http://localhost:3000"
    ).replace(/\/+$/, "");
    const imageUrl = img ? (img.startsWith("http") ? img : `${base}${img}`) : undefined;
    return {
      title: `${nome} | EventosBR`,
      description: desc,
      alternates: { canonical: `/produtor/${perfil.slug}` },
      openGraph: {
        title: nome,
        description: desc,
        type: "website",
        url: `${base}/produtor/${perfil.slug}`,
        ...(imageUrl ? { images: [{ url: imageUrl }] } : {}),
      },
      twitter: {
        card: "summary_large_image",
        title: nome,
        description: desc,
        ...(imageUrl ? { images: [imageUrl] } : {}),
      },
    };
  } catch {
    return { title: "Produtor | EventosBR" };
  }
}

export default async function ProdutorPage({ params }: Props) {
  const { slug } = await params;
  try {
    const initialPerfil = await getProdutorPublicoBySlug(slug);
    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: buildProdutorJsonLd(initialPerfil) }}
        />
        <ProdutorPublicClient slug={slug} initialPerfil={initialPerfil} />
      </>
    );
  } catch {
    notFound();
  }
}
