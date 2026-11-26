/** Vitrine do organizador: o site servido no endereço dele (subdomínio da plataforma ou domínio próprio). */
export type VitrineProdutor = {
  host: string;
  /** Falso quando o domínio próprio está sem assinatura e sem cortesia: o endereço leva à página na EventosBR. */
  liberado: boolean;
  slug: string;
  organizador_id: string;
  nome: string;
  brand_logo_url: string | null;
  /** Favicon escolhido pelo organizador ou, na falta dele, a foto do perfil. */
  brand_favicon_url: string | null;
  /** Nulo = padrão (topo claro, rodapé escuro). */
  brand_tema_vitrine: "claro" | "escuro" | null;
  brand_rodape_texto: string | null;
  /** Só vêm preenchidos com white-label liberado. */
  marketing_meta_pixel_id: string | null;
  marketing_gtm_id: string | null;
  brand_primary_color: string | null;
  brand_primary_color_dark: string | null;
  social_instagram: string | null;
  social_whatsapp: string | null;
  social_site: string | null;
};

/** Definido pelo proxy; qualquer valor vindo do cliente é descartado antes. */
export const VITRINE_HOST_HEADER = "x-vitrine-host";

function apiOrigin(): string {
  const internal = process.env.INTERNAL_API_URL?.trim();
  if (internal) return internal.replace(/\/+$/, "").replace(/\/api$/, "");
  return "http://127.0.0.1:8000";
}

export function platformDomain(): string | null {
  return process.env.NEXT_PUBLIC_PLATFORM_DOMAIN?.trim().toLowerCase() || null;
}

export function urlPlataforma(path: string): string {
  return `https://${platformDomain() ?? "eventosbr.app.br"}${path}`;
}

/** Endereços da própria plataforma (e desenvolvimento local) nunca são vitrine. */
export function hostPodeSerVitrine(host: string): boolean {
  const base = platformDomain();
  const h = host.split(":")[0]?.toLowerCase() ?? "";
  if (!base || !h.includes(".")) return false;
  if (/^\d+(\.\d+){3}$/.test(h)) return false;
  return h !== base && h !== `www.${base}`;
}

export async function fetchVitrinePorHost(host: string): Promise<VitrineProdutor | null> {
  try {
    const res = await fetch(`${apiOrigin()}/api/public/tenant?host=${encodeURIComponent(host)}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return (await res.json()) as VitrineProdutor;
  } catch {
    return null;
  }
}

export type RotaVitrine =
  | { tipo: "pagina-do-produtor" }
  | { tipo: "inicio" }
  | { tipo: "plataforma" }
  | { tipo: "seguir" };

const PREFIXOS_DA_VITRINE = [
  "/eventos/",
  "/auth",
  "/conta",
  "/ingresso",
  "/termos",
  "/privacidade",
  "/ajuda",
  "/contato",
];
const PREFIXOS_TECNICOS = ["/api/", "/uploads/", "/_next/", "/health", "/ready"];

function comecaCom(pathname: string, prefixo: string): boolean {
  return pathname === prefixo.replace(/\/$/, "") || pathname.startsWith(prefixo.endsWith("/") ? prefixo : `${prefixo}/`);
}

/** O que a vitrine faz com cada caminho: só páginas do comprador ficam no endereço do produtor. */
export function rotaNaVitrine(pathname: string, slug: string): RotaVitrine {
  if (pathname === "/" || pathname === "/eventos") return { tipo: "pagina-do-produtor" };
  if (pathname === `/produtor/${slug}`) return { tipo: "inicio" };
  if (PREFIXOS_TECNICOS.some((p) => comecaCom(pathname, p)) || /\.[a-z0-9]+$/i.test(pathname)) {
    return { tipo: "seguir" };
  }
  if (pathname === "/eventos/novo" || pathname.startsWith("/eventos/novo/")) return { tipo: "plataforma" };
  if (/^\/eventos\/[^/]+\/editar/.test(pathname)) return { tipo: "plataforma" };
  return PREFIXOS_DA_VITRINE.some((p) => comecaCom(pathname, p)) ? { tipo: "seguir" } : { tipo: "plataforma" };
}

/** Destino na plataforma quando o domínio próprio não está liberado: o comprador nunca cai numa página quebrada. */
export function caminhoNaPlataforma(pathname: string, slug: string): string {
  return pathname === "/" || pathname === "/eventos" ? `/produtor/${slug}` : pathname;
}
