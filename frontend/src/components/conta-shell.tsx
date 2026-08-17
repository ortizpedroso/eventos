"use client";

import { AppNavLink } from "@/components/app-nav-link";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { fetchSession, peekSessionCache } from "@/lib/api";
import { AUTH_SYNC_EVENT } from "@/lib/auth-sync";

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
  const [ehAdminPlataforma, setEhAdminPlataforma] = useState(() =>
    Boolean(peekSessionCache()?.is_platform_admin),
  );
  const [totpAtivado, setTotpAtivado] = useState(() => Boolean(peekSessionCache()?.totp_ativado));

  useEffect(() => {
    async function syncSession() {
      const u = await fetchSession();
      setEhAdminPlataforma(Boolean(u?.is_platform_admin));
      setTotpAtivado(Boolean(u?.totp_ativado));
    }
    const onSync = () => void syncSession();
    void syncSession();
    window.addEventListener(AUTH_SYNC_EVENT, onSync);
    return () => window.removeEventListener(AUTH_SYNC_EVENT, onSync);
  }, []);

  // Spec admin-integrado-usuario.md §3.5: sem 2FA, o item continua visível mas
  // leva à ativação do 2FA (com explicação) em vez do painel administrativo.
  const hrefAdmin = totpAtivado ? "/admin/dashboard" : "/conta/perfil?ativar_2fa_admin=1";
  const links = ehAdminPlataforma
    ? [...LINKS, { href: hrefAdmin, label: "Administração" } as const]
    : LINKS;

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
            {links.map(({ href, label }) => {
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
