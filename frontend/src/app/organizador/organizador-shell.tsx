"use client";

import type { ReactNode } from "react";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import type { Usuario } from "@/lib/types";

const nav = [
  { href: "/organizador/eventos", label: "Meus eventos" },
  { href: "/organizador/novo", label: "Criar novo evento" },
  { href: "/organizador/perfil", label: "Perfil" },
  { href: "/organizador/relatorios", label: "Relatórios" },
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

export function OrganizadorShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const u = await apiFetch<Usuario>("/api/auth/me", { cache: "no-store" });
        if (cancelled) return;
        if (u.tipo !== "organizador") {
          router.replace("/eventos");
          return;
        }
        setAllowed(true);
      } catch {
        if (!cancelled) router.replace("/auth");
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4 py-16">
        <p className="text-sm text-zinc-600">Carregando painel…</p>
      </div>
    );
  }

  if (!allowed) {
    return null;
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 lg:flex-row lg:gap-10 lg:px-8 lg:py-12">
      <aside className="shrink-0 lg:w-56">
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-b from-emerald-50/90 to-white p-3 shadow-sm ring-1 ring-emerald-200/80 lg:sticky lg:top-24">
          <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-emerald-800">
            Painel
          </p>
          <nav className="flex flex-col gap-1" aria-label="Navegação do organizador">
            {nav.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-emerald-700 text-white shadow-sm"
                      : "text-zinc-800 hover:bg-white/80 hover:text-emerald-900"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
