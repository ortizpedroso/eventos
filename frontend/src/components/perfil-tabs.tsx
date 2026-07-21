"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { slug: "", label: "Perfil" },
  { slug: "pagamentos", label: "Pagamentos" },
  { slug: "ingressos", label: "Ingressos" },
  { slug: "notificacoes", label: "Notificações" },
] as const;

export function PerfilTabs({ base }: { base: string }) {
  const pathname = usePathname();

  return (
    <nav
      className="mt-3 mb-6 flex flex-wrap justify-start gap-1 border-b border-zinc-200 pb-0"
      aria-label="Seções do perfil"
    >
      {TABS.map(({ slug, label }) => {
        const href = slug ? `${base}/${slug}` : base;
        const active = slug ? pathname.startsWith(href) : pathname === base;
        return (
          <Link
            key={label}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`rounded-t-lg border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "border-emerald-700 text-emerald-800"
                : "border-transparent text-zinc-500 hover:text-zinc-800"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
