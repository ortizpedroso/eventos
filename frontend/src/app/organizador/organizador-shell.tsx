"use client";

import type { ReactNode } from "react";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { AppNavLink } from "@/components/app-nav-link";
import { OrganizadorTour } from "@/components/organizador-tour";

const navDesktop = [
  { href: "/organizador/eventos", label: "Meus eventos", tour: "org-eventos" },
  { href: "/organizador/novo", label: "Criar novo evento", tour: "org-novo" },
  { href: "/organizador/perfil", label: "Perfil", tour: "org-perfil" },
  { href: "/organizador/relatorios", label: "Relatórios", tour: "org-relatorios" },
  { href: "/organizador/comunicados", label: "Comunicados", tour: "org-comunicados" },
  { href: "/organizador/checkin", label: "Check-in", tour: "org-checkin" },
  { href: "/organizador/financeiro", label: "Financeiro", tour: "org-financeiro" },
] as const;

const navMobilePrincipal = [
  { href: "/organizador/eventos", label: "Eventos", short: "Eventos", tour: "org-eventos" },
  { href: "/organizador/novo", label: "Criar", short: "Criar", tour: "org-novo" },
  { href: "/organizador/checkin", label: "Check-in", short: "Check-in", tour: "org-checkin" },
  { href: "/organizador/relatorios", label: "Relatórios", short: "Relat.", tour: "org-relatorios" },
] as const;

const navMobileMais = [
  { href: "/organizador/perfil", label: "Perfil" },
  { href: "/organizador/comunicados", label: "Comunicados" },
  { href: "/organizador/financeiro", label: "Financeiro" },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/organizador/eventos") {
    return pathname === "/organizador" || pathname.startsWith("/organizador/eventos");
  }
  if (href === "/organizador/novo") {
    return pathname === "/organizador/novo";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function IconEventos({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
    </svg>
  );
}

function IconMais({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  );
}

function mobileIcon(href: string, className: string) {
  if (href.includes("novo")) {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
    );
  }
  if (href.includes("checkin")) {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z" />
      </svg>
    );
  }
  if (href.includes("relatorios")) {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
      </svg>
    );
  }
  return <IconEventos className={className} />;
}

export function OrganizadorShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [menuMaisAberto, setMenuMaisAberto] = useState(false);

  useEffect(() => {
    setMenuMaisAberto(false);
  }, [pathname]);

  const maisAtivo = navMobileMais.some((item) => isActive(pathname, item.href));

  return (
    <>
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 md:pb-8 lg:flex-row lg:gap-10 lg:px-8 lg:py-12 pb-24">
        <aside className="hidden shrink-0 lg:block lg:w-56">
          <div className="rounded-2xl border border-emerald-200 bg-gradient-to-b from-emerald-50/90 to-white p-3 shadow-sm ring-1 ring-emerald-200/80 lg:sticky lg:top-24">
            <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-emerald-800">
              Painel
            </p>
            <nav className="flex flex-col gap-1" aria-label="Navegação do organizador">
              {navDesktop.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <AppNavLink
                    key={item.href}
                    href={item.href}
                    active={active}
                    data-tour={item.tour}
                    className={`rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? "bg-emerald-700 text-white shadow-sm"
                        : "text-zinc-800 hover:bg-white/80 hover:text-emerald-900"
                    }`}
                  >
                    {item.label}
                  </AppNavLink>
                );
              })}
            </nav>
          </div>
        </aside>
        <div className="min-h-[60vh] min-w-0 flex-1">{children}</div>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
        aria-label="Painel do organizador (mobile)"
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around">
          {navMobilePrincipal.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <AppNavLink
                key={item.href}
                href={item.href}
                active={active}
                data-tour={item.tour}
                className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-2.5 text-[10px] font-medium ${
                  active ? "text-emerald-800" : "text-zinc-500"
                }`}
              >
                {mobileIcon(item.href, `h-5 w-5 ${active ? "text-emerald-700" : "text-zinc-400"}`)}
                <span className="truncate">{item.short}</span>
              </AppNavLink>
            );
          })}
          <button
            type="button"
            onClick={() => setMenuMaisAberto((o) => !o)}
            aria-expanded={menuMaisAberto}
            className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-2.5 text-[10px] font-medium ${
              maisAtivo || menuMaisAberto ? "text-emerald-800" : "text-zinc-500"
            }`}
          >
            <IconMais className={`h-5 w-5 ${maisAtivo || menuMaisAberto ? "text-emerald-700" : "text-zinc-400"}`} />
            <span>Mais</span>
          </button>
        </div>

        {menuMaisAberto ? (
          <>
            <div
              className="fixed inset-0 z-30 bg-black/25 lg:hidden"
              aria-hidden
              onClick={() => setMenuMaisAberto(false)}
            />
            <div className="absolute bottom-full left-0 right-0 z-50 border-t border-zinc-200 bg-white p-3 shadow-lg">
              <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Mais opções
              </p>
              <div className="grid gap-1">
                {navMobileMais.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <AppNavLink
                      key={item.href}
                      href={item.href}
                      active={active}
                      onClick={() => setMenuMaisAberto(false)}
                      className={`rounded-lg px-3 py-2.5 text-sm font-medium ${
                        active
                          ? "bg-emerald-50 text-emerald-900"
                          : "text-zinc-800 hover:bg-zinc-50"
                      }`}
                    >
                      {item.label}
                    </AppNavLink>
                  );
                })}
              </div>
            </div>
          </>
        ) : null}
      </nav>
      <OrganizadorTour />
    </>
  );
}
