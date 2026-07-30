"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Fase 1 do plano de animação (specs/plano-pre-lancamento-posicionamento-animacao.md):
 * observa elementos com a classe `.reveal` e adiciona `.reveal-visible` quando
 * entram na tela — nunca anima a página inteira de uma vez.
 *
 * Sem dependência externa (sem Framer Motion/GSAP) — Intersection Observer nativo,
 * leve e já suportado por todos os navegadores relevantes. Silenciosamente não faz
 * nada se `prefers-reduced-motion` estiver ativo (o CSS já cobre isso, mas evitamos
 * até o custo de observar em vão).
 *
 * Re-escaneia a cada troca de rota (usePathname como dependência) — sem isso, como
 * esse componente vive no layout raiz (não remonta em navegação client-side do
 * Next.js), elementos .reveal de uma página nova nunca seriam observados.
 */
export function ScrollRevealObserver() {
  const pathname = usePathname();

  useEffect(() => {
    const prefereReduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefereReduzido) return;

    let observer: IntersectionObserver | null = null;

    // Pequeno atraso pra garantir que o DOM da página nova já renderizou.
    const timeoutId = window.setTimeout(() => {
      const elementos = document.querySelectorAll<HTMLElement>(".reveal:not(.reveal-visible)");
      if (elementos.length === 0) return;

      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              entry.target.classList.add("reveal-visible");
              observer?.unobserve(entry.target);
            }
          }
        },
        { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
      );

      elementos.forEach((el) => observer?.observe(el));
    }, 50);

    return () => {
      window.clearTimeout(timeoutId);
      observer?.disconnect();
    };
  }, [pathname]);

  return null;
}
