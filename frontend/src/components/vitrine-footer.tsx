import Link from "next/link";

import { urlPlataforma, type VitrineProdutor } from "@/lib/organizer-tenant";
import { resolveUrlPublicaHref } from "@/lib/url-publica";

const TEMAS = {
  escuro: {
    footer: "border-zinc-800 bg-zinc-950 text-zinc-400",
    nome: "text-zinc-100",
    divisor: "border-zinc-800",
    link: "text-zinc-300 underline decoration-zinc-600 underline-offset-2 hover:text-white",
  },
  claro: {
    footer: "border-zinc-200 bg-zinc-50 text-zinc-600",
    nome: "text-zinc-900",
    divisor: "border-zinc-200",
    link: "text-zinc-700 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-950",
  },
} as const;

export function VitrineFooter({ vitrine, platformName }: { vitrine: VitrineProdutor; platformName: string }) {
  const tema = TEMAS[vitrine.brand_tema_vitrine === "claro" ? "claro" : "escuro"];
  const linkClass = tema.link;
  const contatos = [
    { label: "Instagram", href: resolveUrlPublicaHref(vitrine.social_instagram) },
    { label: "WhatsApp", href: resolveUrlPublicaHref(vitrine.social_whatsapp) },
    { label: "Site", href: resolveUrlPublicaHref(vitrine.social_site) },
  ].filter((c): c is { label: string; href: string } => Boolean(c.href));

  return (
    <footer className={`border-t text-sm ${tema.footer}`}>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className={`font-medium ${tema.nome}`}>{vitrine.nome}</p>
          {contatos.length > 0 ? (
            <ul className="flex flex-wrap gap-4">
              {contatos.map((c) => (
                <li key={c.label}>
                  <a href={c.href} target="_blank" rel="noopener noreferrer" className={linkClass}>
                    {c.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {vitrine.brand_rodape_texto ? (
          <p className="whitespace-pre-line text-xs" data-vitrine-rodape-texto>
            {vitrine.brand_rodape_texto}
          </p>
        ) : null}
        <p className={`border-t pt-6 text-xs ${tema.divisor}`} data-plataforma-eventosbr>
          Dúvidas sobre o evento? Fale com {vitrine.nome}. Ingressos e pagamentos pela plataforma{" "}
          <a href={urlPlataforma("/")} target="_blank" rel="noopener noreferrer" className={linkClass}>
            {platformName}
          </a>
          {" · "}
          <Link href="/ajuda" className={linkClass}>
            Ajuda com a plataforma
          </Link>
          {" · "}
          <Link href="/termos" className={linkClass}>
            Termos
          </Link>
          {" · "}
          <Link href="/privacidade" className={linkClass}>
            Privacidade
          </Link>
        </p>
      </div>
    </footer>
  );
}
