"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect } from "react";

// AppNavLink (usado no shell organizador/conta) desliga o scroll nativo do Next
// (scroll={false}) de propósito — então o ScrollToTop PRECISA cobrir essas rotas,
// senão nenhum dos dois mecanismos reseta o scroll (bug: página sempre abre no meio).
const SEM_SCROLL_RESET = /^\/planos(?:\/|$)/;

/** Garante scroll no topo antes do paint após navegação pública. */
export function ScrollToTop() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    if (SEM_SCROLL_RESET.test(pathname)) {
      return;
    }
    if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  return null;
}
