"use client";

import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect } from "react";

function resetScroll() {
  if (typeof window === "undefined") return;
  window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

/** Garante que cada navegação começa no topo (evita rodapé visível no meio da tela). */
export function ScrollToTop() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    resetScroll();
  }, [pathname]);

  useEffect(() => {
    resetScroll();
  }, [pathname]);

  return null;
}
