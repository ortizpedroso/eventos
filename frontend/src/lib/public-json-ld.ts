import { serializeJsonLdForScript } from "@/lib/json-ld-html";
import type { BlogPostMeta } from "@/lib/blog";
import type { ProdutorPerfilPublico } from "@/lib/produtor-publico";
import { resolveEventoImagemSrc } from "@/lib/evento-imagem-url";

function siteBase(): string {
  return (
    process.env.NEXT_PUBLIC_LAN_ORIGIN ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://eventosbr.app.br"
  ).replace(/\/+$/, "");
}

function absUrl(pathOrUrl: string | null | undefined, base: string): string | undefined {
  if (!pathOrUrl?.trim()) return undefined;
  const v = pathOrUrl.trim();
  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  return `${base}${v.startsWith("/") ? v : `/${v}`}`;
}

/** ProfilePage / Person — página pública do produtor. */
export function buildProdutorJsonLd(perfil: ProdutorPerfilPublico): string {
  const base = siteBase();
  const nome = perfil.brand_name?.trim() || perfil.nome;
  const img =
    resolveEventoImagemSrc(perfil.foto_url || perfil.brand_logo_url) ||
    undefined;
  const sameAs = [
    perfil.social_instagram,
    perfil.social_site,
    perfil.social_whatsapp
      ? `https://wa.me/${perfil.social_whatsapp.replace(/\D/g, "")}`
      : null,
  ].filter((u): u is string => Boolean(u && String(u).trim()));

  return serializeJsonLdForScript({
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url: `${base}/produtor/${perfil.slug}`,
    name: nome,
    description: (perfil.bio || "").trim().slice(0, 500) || undefined,
    mainEntity: {
      "@type": "Person",
      name: nome,
      description: (perfil.bio || "").trim().slice(0, 500) || undefined,
      image: absUrl(img, base),
      url: `${base}/produtor/${perfil.slug}`,
      ...(sameAs.length ? { sameAs } : {}),
    },
  });
}

/** BlogPosting — artigo do blog. */
export function buildBlogPostingJsonLd(meta: BlogPostMeta): string {
  const base = siteBase();
  return serializeJsonLdForScript({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: meta.title,
    description: meta.excerpt || undefined,
    datePublished: meta.date || undefined,
    url: `${base}/blog/${meta.slug}`,
    mainEntityOfPage: `${base}/blog/${meta.slug}`,
    author: {
      "@type": "Organization",
      name: "EventosBR",
      url: base,
    },
    publisher: {
      "@type": "Organization",
      name: "EventosBR",
      url: base,
      logo: {
        "@type": "ImageObject",
        url: `${base}/logo.svg`,
      },
    },
  });
}

/** CollectionPage + ItemList — índice do blog. */
export function buildBlogIndexJsonLd(posts: BlogPostMeta[]): string {
  const base = siteBase();
  return serializeJsonLdForScript({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Blog EventosBR",
    url: `${base}/blog`,
    description: "Novidades, dicas e conteúdo sobre eventos, ingressos e organização.",
    mainEntity: {
      "@type": "ItemList",
      itemListElement: posts.slice(0, 20).map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: p.title,
        url: `${base}/blog/${p.slug}`,
      })),
    },
  });
}

type EventoListItem = {
  nome: string;
  slug: string;
};

/** CollectionPage + ItemList — listagem /eventos. */
export function buildEventosListagemJsonLd(
  eventos: EventoListItem[],
  opts?: { q?: string; categoria?: string; cidade?: string },
): string {
  const base = siteBase();
  const partes = ["Eventos"];
  if (opts?.q) partes.push(`busca: ${opts.q}`);
  if (opts?.categoria) partes.push(opts.categoria);
  if (opts?.cidade) partes.push(opts.cidade);
  const name = partes.join(" — ");

  return serializeJsonLdForScript({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    url: `${base}/eventos`,
    description: "Encontre eventos e garanta seu ingresso na EventosBR.",
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: eventos.length,
      itemListElement: eventos.slice(0, 30).map((e, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: e.nome,
        url: `${base}/eventos/${e.slug}`,
      })),
    },
  });
}
