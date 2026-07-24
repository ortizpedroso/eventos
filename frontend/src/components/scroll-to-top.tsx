"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect } from "react";

const SEM_SCROLL_RESET = /^\/(?:auth|organizador|conta|planos)(?:\/|$)/;

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
