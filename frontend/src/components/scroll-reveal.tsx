"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

type Props = {
  children: ReactNode;
  className?: string;
  /** Atraso em ms ao entrar na viewport (efeito cascata entre cards). */
  delayMs?: number;
};

export function ScrollReveal({ children, className = "", delayMs = 0 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const show = () => setVisible(true);

    /* prefers-reduced-motion: mostrar já (evita conteúdo invisível). */
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      show();
      return;
    }

    /* Se já está visível no primeiro layout, não depender só do observer (Safari / contentores). */
    const checkImmediate = () => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const overlap = Math.min(r.bottom, vh) - Math.max(r.top, 0);
      if (overlap > 8 && r.width > 0) {
        show();
        return true;
      }
      return false;
    };

    if (checkImmediate()) {
      return;
    }

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          show();
          obs.disconnect();
        }
      },
      { rootMargin: "0px 0px 8% 0px", threshold: 0.01 },
    );
    obs.observe(el);

    const t = window.setTimeout(() => {
      show();
      obs.disconnect();
    }, 4500);

    return () => {
      window.clearTimeout(t);
      obs.disconnect();
    };
  }, []);

  const style: CSSProperties | undefined =
    delayMs > 0
      ? { transitionDelay: visible ? `${delayMs}ms` : "0ms" }
      : undefined;

  return (
    <div
      ref={ref}
      style={style}
      className={`transform-gpu transition-[opacity,transform] duration-700 ease-out motion-reduce:duration-0 ${
        visible
          ? "translate-y-0 opacity-100"
          : "translate-y-8 opacity-0 motion-reduce:translate-y-0 motion-reduce:opacity-100"
      } ${className}`}
    >
      {children}
    </div>
  );
}
