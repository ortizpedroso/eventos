"use client";

import { AppNavLink } from "@/components/app-nav-link";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/conta/perfil", label: "Perfil" },
  { href: "/conta/pagamentos", label: "Pagamentos" },
  { href: "/conta/ingressos", label: "Ingressos" },
  { href: "/conta/notificacoes", label: "Notificações" },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/conta/ingressos") {
    return pathname === href || pathname.startsWith("/conta/ingressos/");
  }
  return pathname === href;
}

export function ContaShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 pb-24 lg:flex-row lg:gap-10 lg:pb-8">
      <aside className="shrink-0 lg:w-56">
        <div className="rounded-2xl border border-zinc-200 bg-gradient-to-b from-zinc-50 to-white p-3 shadow-sm lg:sticky lg:top-24">
          <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Minha conta
          </p>
          <nav
            className="-mx-1 flex flex-row gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0"
            aria-label="Área da conta"
          >
            {LINKS.map(({ href, label }) => {
              const ativo = isActive(pathname, href);
              return (
                <AppNavLink
                  key={href}
                  href={href}
                  active={ativo}
                  className={`shrink-0 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    ativo
                      ? "bg-emerald-700 text-white shadow-sm"
                      : "text-zinc-800 hover:bg-white/80 hover:text-emerald-900"
                  }`}
                >
                  {label}
                </AppNavLink>
              );
            })}
          </nav>
        </div>
      </aside>
      <div className="min-h-[60vh] min-w-0 flex-1 textos-justificados">
        {children}
      </div>
    </div>
  );
}
