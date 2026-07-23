"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/** Garante scroll no topo após navegação (useEffect evita bloquear paint). */
export function ScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  return null;
}
