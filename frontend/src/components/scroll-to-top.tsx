"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/** Garante que cada navegação começa no topo (evita conteúdo cortado sob o navbar). */
export function ScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
