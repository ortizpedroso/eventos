"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useLayoutEffect } from "react";

/** Garante que cada navegação começa no topo (evita rodapé/título cortado sob o navbar). */
export function ScrollToTop() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname, searchParams]);

  return null;
}
