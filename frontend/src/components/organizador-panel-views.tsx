"use client";

import { usePathname } from "next/navigation";
import { type ComponentType, type ReactNode, useRef } from "react";

import { OrganizadorEventosClient } from "@/app/organizador/eventos/organizador-eventos-client";
import { OrganizadorFinanceiroClient } from "@/app/organizador/financeiro/organizador-financeiro-client";
import { OrganizadorRelatoriosClient } from "@/app/organizador/relatorios/organizador-relatorios-client";

/** Rotas do painel principal — montadas uma vez e alternadas com hidden (padrão abas SPA). */
const PANEL_ROUTES: Record<string, ComponentType> = {
  "/organizador/eventos": OrganizadorEventosClient,
  "/organizador/relatorios": OrganizadorRelatoriosClient,
  "/organizador/financeiro": OrganizadorFinanceiroClient,
};

/**
 * Evita desmontagem ao alternar Eventos / Financeiro / Relatórios.
 * Next.js App Router remontaria page.tsx a cada clique; aqui o React preserva instância + cache.
 */
export function OrganizadorPanelViews({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const mountedRef = useRef(new Set<string>());

  if (PANEL_ROUTES[pathname]) {
    mountedRef.current.add(pathname);
  }

  const mounted = [...mountedRef.current];
  const isPanelRoute = Boolean(PANEL_ROUTES[pathname]);

  if (mounted.length === 0 && !isPanelRoute) {
    return <>{children}</>;
  }

  return (
    <>
      {mounted.map((path) => {
        const View = PANEL_ROUTES[path];
        if (!View) return null;
        const visible = path === pathname;
        return (
          <div
            key={path}
            className={visible ? "contents" : "hidden"}
            aria-hidden={!visible}
            data-panel-route={path}
          >
            <View />
          </div>
        );
      })}
      {!isPanelRoute ? children : null}
    </>
  );
}
