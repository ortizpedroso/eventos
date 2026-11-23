import type { Metadata } from "next";

import type { PlatformSettings } from "@/lib/platform-settings";
import { DEFAULT_PLATFORM_SETTINGS } from "@/lib/platform-settings";
import type { VitrineProdutor } from "@/lib/organizer-tenant";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://eventosbr.app.br";

/** Imagem padrão da prévia de link (WhatsApp, Facebook…). Ao trocar o PNG, suba o `v` para furar o cache. */
export const DEFAULT_OG_IMAGE = {
  url: `${SITE_URL}/og-image.png?v=2`,
  width: 1200,
  height: 630,
  alt: "EventosBR — ingressos para shows, festas e eventos",
};

const SITE_DESCRIPTION =
  "Venda e compre ingressos para shows, festas, palestras e eventos corporativos. PIX e cartão, QR Code na entrada, reembolsos automáticos e repasse direto para organizadores. Crie sua conta grátis.";

export function buildMetadata(platform: PlatformSettings): Metadata {
  const siteName = platform.site_name || "EventosBR";
  const title = `${siteName} — Ingressos, Shows e Eventos Online no Brasil`;
  const ogImage = { ...DEFAULT_OG_IMAGE, alt: siteName };

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: title,
      template: `%s | ${siteName}`,
    },
    description: SITE_DESCRIPTION,
    openGraph: {
      type: "website",
      locale: "pt_BR",
      siteName,
      title,
      description: SITE_DESCRIPTION,
      url: SITE_URL,
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: SITE_DESCRIPTION,
      images: [ogImage.url],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

/** Metadados do site servido no endereço do organizador: nome dele no título e na prévia de link. */
export function buildVitrineMetadata(vitrine: VitrineProdutor): Metadata {
  const description = `Eventos e ingressos de ${vitrine.nome}.`;
  return {
    metadataBase: new URL(`https://${vitrine.host}`),
    title: { default: vitrine.nome, template: `%s | ${vitrine.nome}` },
    description,
    openGraph: {
      type: "website",
      locale: "pt_BR",
      siteName: vitrine.nome,
      title: vitrine.nome,
      description,
      url: `https://${vitrine.host}/`,
    },
    robots: { index: true, follow: true },
  };
}

export const SITE_TITLE = "EventosBR — Ingressos, Shows e Eventos Online no Brasil";
export const SITE_DESCRIPTION_EXPORT = SITE_DESCRIPTION;

export const homeMetadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE.url],
  },
};

/** @deprecated use buildMetadata(platform) no layout raiz */
export const defaultMetadata: Metadata = buildMetadata(DEFAULT_PLATFORM_SETTINGS);
