"use client";

import { useLayoutEffect } from "react";

/** Garante topo da página ao abrir login/cadastro (links com scroll={false} na origem). */
export function AuthScrollReset() {
  useLayoutEffect(() => {
    if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, []);

  return null;
}
