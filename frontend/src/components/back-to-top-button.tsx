"use client";

import { useEffect, useState } from "react";

const MOSTRAR_APOS_PX = 400;

/** Seta flutuante no canto inferior direito — aparece após rolar a página, volta ao topo suavemente. */
export function BackToTopButton() {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisivel(window.scrollY > MOSTRAR_APOS_PX);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function voltarAoTopo() {
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  }

  return (
    <button
      type="button"
      onClick={voltarAoTopo}
      aria-label="Voltar ao topo"
      className={`fixed bottom-20 right-5 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-zinc-900 text-white shadow-lg ring-1 ring-black/10 transition-all duration-200 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 sm:bottom-6 sm:right-6 lg:bottom-6 ${
        visivel ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
      }`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5M6 11l6-6 6 6" />
      </svg>
    </button>
  );
}
