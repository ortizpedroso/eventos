import type { Metadata } from "next";

import type { PlatformSettings } from "@/lib/platform-settings";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://eventosbr.app.br";

const SITE_DESCRIPTION =
  "Venda e compre ingressos para shows, festas, palestras e eventos corporativos. PIX e cartão, QR Code na entrada, reembolsos automáticos e repasse direto para organizadores. Crie sua conta grátis.";

export function buildMetadata(platform: PlatformSettings): Metadata {
  const siteName = platform.site_name || "EventosBR";
  const title = `${siteName} — Ingressos, Shows e Eventos Online no Brasil`;

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
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: SITE_DESCRIPTION,
    },
    robots: {
      index: true,
      follow: true,
    },
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
  },
};

/** @deprecated use buildMetadata(platform) no layout raiz */
export const defaultMetadata: Metadata = buildMetadata({
  site_name: "EventosBR",
  site_tagline: null,
  footer_description: null,
  contact_email: null,
  support_email: null,
  logo_url: null,
  logo_light_url: null,
  favicon_url: null,
  primary_color: "#10b981",
  primary_color_dark: "#047857",
  social_instagram_url: null,
  social_whatsapp_url: null,
  social_linkedin_url: null,
  social_x_url: null,
  social_youtube_url: null,
});
