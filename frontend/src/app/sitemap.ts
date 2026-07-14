import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://eventosbr.app.br";

const rotasEstaticas = [
  "",
  "/eventos",
  "/funcionalidades",
  "/planos",
  "/sobre",
  "/ajuda",
  "/blog",
  "/documentacao",
  "/documentacao/api",
  "/termos",
  "/privacidade",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return rotasEstaticas.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency: path === "" || path === "/eventos" ? "daily" : "weekly",
    priority: path === "" ? 1 : path === "/eventos" ? 0.9 : 0.7,
  }));
}
