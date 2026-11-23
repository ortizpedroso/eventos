import Link from "next/link";

import { resolveEventoImagemSrc } from "@/lib/evento-imagem-url";
import type { VitrineProdutor } from "@/lib/organizer-tenant";

export function VitrineHeader({ vitrine }: { vitrine: VitrineProdutor }) {
  const logo = resolveEventoImagemSrc(vitrine.brand_logo_url);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-3" aria-label={`${vitrine.nome} — início`}>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt={vitrine.nome} className="h-10 w-auto max-w-[12rem] object-contain" />
          ) : (
            <span className="truncate text-lg font-semibold text-zinc-900">{vitrine.nome}</span>
          )}
        </Link>
        <Link
          href="/conta"
          className="shrink-0 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-800 transition hover:border-zinc-300 hover:bg-zinc-50"
        >
          Meus ingressos
        </Link>
      </div>
    </header>
  );
}
