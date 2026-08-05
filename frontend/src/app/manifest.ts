import type { MetadataRoute } from "next";

/** Manifest mínimo — ícone de instalação / splash em mobile (sem service worker). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "EventosBR",
    short_name: "EventosBR",
    description: "Ingressos e eventos no Brasil — compre e venda com PIX e cartão.",
    start_url: "/",
    display: "browser",
    background_color: "#fafafa",
    theme_color: "#10b981",
    lang: "pt-BR",
    icons: [
      {
        src: "/logo-icon.svg",
        type: "image/svg+xml",
        sizes: "any",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        type: "image/svg+xml",
        sizes: "any",
        purpose: "any",
      },
    ],
  };
}
