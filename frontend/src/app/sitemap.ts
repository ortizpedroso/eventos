import type { MetadataRoute } from "next";

import { fetchEventosPublicos } from "@/lib/eventos-publicos";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://eventosbr.app.br";

const rotasEstaticas = [
  "",
  "/eventos",
  "/funcionalidades",
  "/produtores",
  "/planos",
  "/sobre",
  "/ajuda",
  "/contato",
  "/blog",
  "/documentacao",
  "/documentacao/api",
  "/termos",
  "/privacidade",
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const rotasEstaticasEntries: MetadataRoute.Sitemap = rotasEstaticas.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency: path === "" || path === "/eventos" ? "daily" : "weekly",
    priority: path === "" ? 1 : path === "/eventos" ? 0.9 : 0.7,
  }));

  let eventosEntries: MetadataRoute.Sitemap = [];
  try {
    // Limite máximo aceito pela API pública (ver app/routes/eventos.py::listar_eventos).
    const eventos = await fetchEventosPublicos(100);
    eventosEntries = eventos
      .filter((evento) => Boolean(evento.slug))
      .map((evento) => ({
        url: `${SITE_URL}/eventos/${evento.slug}`,
        lastModified: evento.data_criacao ? new Date(evento.data_criacao) : now,
        changeFrequency: "daily",
        priority: 0.8,
      }));
  } catch {
    // Sitemap não deve quebrar o build/deploy se a API estiver indisponível no momento da geração.
    eventosEntries = [];
  }

  return [...rotasEstaticasEntries, ...eventosEntries];
}
