import Link from "next/link";

import { authHrefParaCriarEvento } from "@/lib/criar-evento-routes";

function apiLabel() {
  const custom = process.env.NEXT_PUBLIC_API_DISPLAY?.trim();
  if (custom) return custom;
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!raw) return "Mesma origem (proxy)";
  const host = raw.replace(/\/+$/, "").replace(/^https?:\/\//, "").split("/")[0];
  if (/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host)) {
    return "Ambiente local";
  }
  return host;
}

/** Defina no `.env` as URLs reais; até lá os ícones apontam para `#`. */
const social = {
  instagram: process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM_URL?.trim() || "#",
  linkedin: process.env.NEXT_PUBLIC_SOCIAL_LINKEDIN_URL?.trim() || "#",
  x: process.env.NEXT_PUBLIC_SOCIAL_X_URL?.trim() || "#",
  youtube: process.env.NEXT_PUBLIC_SOCIAL_YOUTUBE_URL?.trim() || "#",
} as const;

function IconInstagram({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

function IconLinkedIn({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function IconX({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function IconYoutube({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();

  const socialLinks = [
    { href: social.instagram, label: "Instagram", Icon: IconInstagram },
    { href: social.linkedin, label: "LinkedIn", Icon: IconLinkedIn },
    { href: social.x, label: "X", Icon: IconX },
    { href: social.youtube, label: "YouTube", Icon: IconYoutube },
  ] as const;

  return (
    <footer className="relative mt-auto border-t border-emerald-500/20 bg-zinc-950 text-zinc-400">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(16,185,129,0.12),transparent)]"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" aria-hidden />

      <div className="relative mx-auto w-full max-w-7xl px-4 pb-10 pt-14 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-4">
            <Link
              href="/"
              className="inline-flex items-baseline gap-0.5 text-2xl font-extrabold tracking-tight text-white"
            >
              EventosBR
              <span className="text-lg font-bold text-emerald-400">.</span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-zinc-500">
              Ingressos, reembolsos e repasses com transparência — do primeiro clique ao dia do evento.
            </p>
          </div>

          <div className="grid gap-10 sm:grid-cols-2 lg:col-span-5 lg:grid-cols-2">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-500/90">
                Plataforma
              </h2>
              <ul className="mt-4 space-y-3 text-sm">
                <li>
                  <Link href="/eventos" className="text-zinc-400 transition-colors hover:text-emerald-300">
                    Explorar eventos
                  </Link>
                </li>
                <li>
                  <Link href="/planos" className="text-zinc-400 transition-colors hover:text-emerald-300">
                    Planos e preços
                  </Link>
                </li>
                <li>
                  <Link href="/funcionalidades" className="text-zinc-400 transition-colors hover:text-emerald-300">
                    Funcionalidades
                  </Link>
                </li>
                <li>
                  <Link href="/documentacao" className="text-zinc-400 transition-colors hover:text-emerald-300">
                    Documentação
                  </Link>
                </li>
                <li>
                  <Link href={authHrefParaCriarEvento()} className="text-zinc-400 transition-colors hover:text-emerald-300">
                    Publicar evento
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-500/90">
                Empresa
              </h2>
              <ul className="mt-4 space-y-3 text-sm">
                <li>
                  <Link href="/sobre" className="text-zinc-400 transition-colors hover:text-emerald-300">
                    Sobre nós
                  </Link>
                </li>
                <li>
                  <Link href="/termos" className="text-zinc-400 transition-colors hover:text-emerald-300">
                    Termos de uso
                  </Link>
                </li>
                <li>
                  <Link href="/privacidade" className="text-zinc-400 transition-colors hover:text-emerald-300">
                    Privacidade
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="lg:col-span-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-500/90">
              Redes sociais
            </h2>
            <p className="mt-2 text-sm text-zinc-500">Siga a EventosBR nas redes.</p>
            <ul className="mt-5 flex flex-wrap gap-3">
              {socialLinks.map(({ href, label, Icon }) => (
                <li key={label}>
                  <a
                    href={href}
                    {...(href === "#"
                      ? {}
                      : { target: "_blank" as const, rel: "noopener noreferrer" })}
                    aria-label={label}
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-700/90 bg-zinc-900/80 text-zinc-300 shadow-inner transition-colors hover:border-emerald-500/60 hover:bg-emerald-950/40 hover:text-emerald-300"
                  >
                    <Icon className="h-[1.125rem] w-[1.125rem]" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-zinc-800/90 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-zinc-500">© {year} EventosBR. Todos os direitos reservados.</p>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">API</span>
            <code className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 font-mono text-[10px] text-zinc-500">
              {apiLabel()}
            </code>
          </div>
        </div>
      </div>
    </footer>
  );
}
