import { serializeJsonLdForScript } from "@/lib/json-ld-html";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://eventosbr.app.br";

export function buildOrganizationJsonLd(siteName = "EventosBR") {
  return serializeJsonLdForScript({
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteName,
    url: SITE_URL,
    logo: `${SITE_URL}/logo.svg`,
    sameAs: [],
  });
}
