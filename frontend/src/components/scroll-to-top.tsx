"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect } from "react";

/** Garante que cada navegação começa no topo (evita rodapé visível no meio da tela). */
export function ScrollToTop() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname]);

  return null;
}
