"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/conta/pagamentos", label: "Pagamentos" },
  { href: "/conta/ingressos", label: "Ingressos" },
  { href: "/conta/perfil", label: "Perfil" },
] as const;

export function ContaNav() {
  const pathname = usePathname();

  return (
    <nav
      className="flex flex-wrap gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1 text-sm"
      aria-label="Área da conta"
    >
      {LINKS.map(({ href, label }) => {
        const ativo = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={ativo ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
              ativo
                ? "bg-white text-emerald-900 shadow-sm ring-1 ring-zinc-200"
                : "text-zinc-600 hover:bg-white/80 hover:text-zinc-900"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
