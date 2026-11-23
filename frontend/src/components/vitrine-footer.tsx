import Link from "next/link";

import { urlPlataforma, type VitrineProdutor } from "@/lib/organizer-tenant";
import { resolveUrlPublicaHref } from "@/lib/url-publica";

const linkClass = "text-zinc-300 underline decoration-zinc-600 underline-offset-2 hover:text-white";

export function VitrineFooter({ vitrine, platformName }: { vitrine: VitrineProdutor; platformName: string }) {
  const contatos = [
    { label: "Instagram", href: resolveUrlPublicaHref(vitrine.social_instagram) },
    { label: "WhatsApp", href: resolveUrlPublicaHref(vitrine.social_whatsapp) },
    { label: "Site", href: resolveUrlPublicaHref(vitrine.social_site) },
  ].filter((c): c is { label: string; href: string } => Boolean(c.href));

  return (
    <footer className="border-t border-zinc-800 bg-zinc-950 text-sm text-zinc-400">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-medium text-zinc-100">{vitrine.nome}</p>
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
        <p className="border-t border-zinc-800 pt-6 text-xs" data-plataforma-eventosbr>
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
