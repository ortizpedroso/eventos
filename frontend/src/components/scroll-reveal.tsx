"use client";

import {
  useLayoutEffect,
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

function isInViewport(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  const vh = window.innerHeight || document.documentElement.clientHeight || 0;
  if (r.width <= 0 || r.height <= 0) return false;
  return r.bottom > 0 && r.top < vh;
}

export function ScrollReveal({ children, className = "", delayMs = 0 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    let cancelled = false;
    const show = () => {
      if (!cancelled) setVisible(true);
    };

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      show();
      return;
    }

    const tryShow = () => {
      if (isInViewport(el)) {
        show();
        return true;
      }
      return false;
    };

    if (tryShow()) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          show();
          obs.disconnect();
        }
      },
      { rootMargin: "0px", threshold: 0 },
    );
    obs.observe(el);

    const onLayout = () => {
      if (tryShow()) obs.disconnect();
    };

    window.addEventListener("load", onLayout, { once: true });
    window.addEventListener("resize", onLayout);

    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(onLayout);
    });

    const fallback = window.setTimeout(() => {
      show();
      obs.disconnect();
    }, 600);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
      window.clearTimeout(fallback);
      window.removeEventListener("resize", onLayout);
      obs.disconnect();
    };
  }, []);

  const style: CSSProperties | undefined =
    delayMs > 0 ? { transitionDelay: visible ? `${delayMs}ms` : "0ms" } : undefined;

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
