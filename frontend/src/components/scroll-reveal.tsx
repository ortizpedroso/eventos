"use client";

import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";

import { MOTION_REVEAL_DURATION_MS, isElementInViewport, prefersReducedMotion } from "@/lib/motion";

type Props = {
  children: ReactNode;
  className?: string;
  /** Atraso em ms ao entrar na viewport (efeito cascata entre cards). */
  delayMs?: number;
};

/**
 * Revela conteúdo ao rolar. Sem JS, o conteúdo permanece 100% visível.
 * Só aplica opacidade reduzida em elementos abaixo da dobra, após hidratação.
 */
export function ScrollReveal({ children, className = "", delayMs = 0 }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;

    if (isElementInViewport(el)) {
      el.classList.add("motion-reveal--shown");
      return;
    }

    el.classList.add("motion-reveal--pending");

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          el.classList.add("motion-reveal--shown");
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -2% 0px", threshold: 0.05 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const style: CSSProperties = {
    ["--reveal-duration" as string]: `${MOTION_REVEAL_DURATION_MS}ms`,
    ...(delayMs > 0 ? { ["--reveal-delay" as string]: `${delayMs}ms` } : {}),
  };

  return (
    <div ref={ref} style={style} className={`motion-reveal ${className}`.trim()}>
      {children}
    </div>
  );
}
