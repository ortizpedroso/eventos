"use client";

import { usePathname } from "next/navigation";
import { type ReactNode, useRef } from "react";

/** Rotas do painel onde alternar abas não deve desmontar o conteúdo (evita piscada). */
const ROTAS_KEEPALIVE = new Set([
  "/organizador/eventos",
  "/organizador/relatorios",
  "/organizador/financeiro",
]);

/**
 * Mantém instâncias montadas das páginas do painel — ao voltar em Eventos/Financeiro/Relatórios
 * o React preserva estado e cache em memória (mesmo efeito da área Conta).
 */
export function OrganizadorPanelKeepAlive({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const cacheRef = useRef(new Map<string, ReactNode>());

  if (ROTAS_KEEPALIVE.has(pathname) && !cacheRef.current.has(pathname)) {
    cacheRef.current.set(pathname, children);
  }

  const entradas = [...cacheRef.current.entries()];

  if (entradas.length === 0) {
    return <>{children}</>;
  }

  return (
    <>
      {entradas.map(([path, node]) => (
        <div key={path} className={path === pathname ? "contents" : "hidden"} aria-hidden={path !== pathname}>
          {node}
        </div>
      ))}
      {!ROTAS_KEEPALIVE.has(pathname) ? children : null}
    </>
  );
}
