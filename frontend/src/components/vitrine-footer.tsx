import Link from "next/link";

import { urlPlataforma, type VitrineProdutor } from "@/lib/organizer-tenant";
import { resolveUrlPublicaHref } from "@/lib/url-publica";

const TEMAS = {
  escuro: {
    footer: "border-zinc-800 bg-zinc-950 text-zinc-300",
    titulo: "text-white",
    secundario: "text-zinc-400",
    divisor: "border-zinc-800",
    link: "text-zinc-200 underline decoration-zinc-600 underline-offset-2 hover:text-white",
    botao: "bg-white text-zinc-950 hover:bg-zinc-200",
  },
  claro: {
    footer: "border-zinc-200 bg-zinc-50 text-zinc-700",
    titulo: "text-zinc-950",
    secundario: "text-zinc-500",
    divisor: "border-zinc-200",
    link: "text-zinc-800 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-950",
    botao: "bg-zinc-900 text-white hover:bg-zinc-700",
  },
} as const;

export function VitrineFooter({ vitrine, platformName }: { vitrine: VitrineProdutor; platformName: string }) {
  const tema = TEMAS[vitrine.brand_tema_vitrine === "claro" ? "claro" : "escuro"];
  const whatsapp = resolveUrlPublicaHref(vitrine.social_whatsapp);
  const outros = [
    { label: "Instagram", href: resolveUrlPublicaHref(vitrine.social_instagram) },
    { label: "Site", href: resolveUrlPublicaHref(vitrine.social_site) },
  ].filter((c): c is { label: string; href: string } => Boolean(c.href));

  return (
    <footer className={`border-t text-sm ${tema.footer}`}>
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3 lg:px-8">
        <section aria-label={vitrine.nome}>
          <p className={`text-base font-semibold ${tema.titulo}`}>{vitrine.nome}</p>
          {vitrine.brand_rodape_texto ? (
            <p className={`mt-2 whitespace-pre-line ${tema.secundario}`} data-vitrine-rodape-texto>
              {vitrine.brand_rodape_texto}
            </p>
          ) : null}
        </section>

        <section aria-labelledby="vitrine-contato">
          <p id="vitrine-contato" className={`font-semibold ${tema.titulo}`}>
            Dúvidas sobre o evento?
          </p>
          <p className={`mt-1 ${tema.secundario}`}>Fale com {vitrine.nome}.</p>
          {whatsapp ? (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className={`mt-3 inline-flex items-center rounded-lg px-4 py-2 font-semibold transition ${tema.botao}`}
              data-vitrine-whatsapp
            >
              Chamar no WhatsApp
            </a>
          ) : null}
          {outros.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-4">
              {outros.map((c) => (
                <li key={c.label}>
                  <a href={c.href} target="_blank" rel="noopener noreferrer" className={tema.link}>
                    {c.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section aria-labelledby="vitrine-compra-segura" data-plataforma-eventosbr>
          <p id="vitrine-compra-segura" className={`font-semibold ${tema.titulo}`}>
            Compra segura
          </p>
          <p className={`mt-1 ${tema.secundario}`}>
            Ingressos e pagamento pela plataforma{" "}
            <a href={urlPlataforma("/")} target="_blank" rel="noopener noreferrer" className={tema.link}>
              {platformName}
            </a>
            .
          </p>
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/ajuda" className={tema.link}>
              Ajuda
            </Link>
            <Link href="/termos" className={tema.link}>
              Termos
            </Link>
            <Link href="/privacidade" className={tema.link}>
              Privacidade
            </Link>
          </p>
        </section>
      </div>
    </footer>
  );
}
