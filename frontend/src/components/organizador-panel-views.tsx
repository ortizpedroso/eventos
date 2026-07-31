"use client";

import { usePathname } from "next/navigation";
import { type ComponentType, type ReactNode, useEffect, useState } from "react";

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
 *
 * Usa useState (persistido via useEffect) em vez de mutar um ref durante o render — mutar/ler
 * `ref.current` no corpo do componente viola a regra do React (react-hooks/refs) e pode fazer o
 * componente não atualizar como esperado. Pra não perder o efeito de "sem flash na primeira
 * visita" que o ref dava de graça, o pathname atual é incluído via um cálculo derivado (só
 * leitura, sem mutação) no próprio render — o useEffect só persiste isso no estado pra lembrar
 * nas trocas de aba seguintes.
 */
export function OrganizadorPanelViews({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mountedSet, setMountedSet] = useState<Set<string>>(() =>
    PANEL_ROUTES[pathname] ? new Set([pathname]) : new Set(),
  );

  const isPanelRoute = Boolean(PANEL_ROUTES[pathname]);
  // Cálculo derivado, só leitura — inclui o pathname atual mesmo antes do efeito abaixo rodar,
  // evitando um frame em branco na primeira visita a uma rota do painel.
  const mounted = isPanelRoute && !mountedSet.has(pathname) ? [...mountedSet, pathname] : [...mountedSet];

  useEffect(() => {
    if (!isPanelRoute) return;
    setMountedSet((prev) => (prev.has(pathname) ? prev : new Set(prev).add(pathname)));
  }, [pathname, isPanelRoute]);

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
