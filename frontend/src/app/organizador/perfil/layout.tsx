"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const SECOES = [
  { href: "/organizador/perfil", label: "Perfil", exact: true },
  { href: "/organizador/perfil/pagamentos", label: "Pagamentos" },
  { href: "/organizador/perfil/ingressos", label: "Ingressos" },
  { href: "/organizador/perfil/notificacoes", label: "Notificações" },
] as const;

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href || pathname === `${href}/`;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function OrganizadorPerfilLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <nav
        className="flex flex-wrap gap-2 border-b border-zinc-100 pb-4"
        aria-label="Seções da conta"
      >
        {SECOES.map((s) => {
          const active = isActive(pathname, s.href, "exact" in s ? s.exact : false);
          return (
            <Link
              key={s.href}
              href={s.href}
              className={`rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition-colors ${
                active
                  ? "bg-emerald-700 text-white"
                  : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
              }`}
            >
              {s.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
