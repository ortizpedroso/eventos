"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import {
  MOTION_REVEAL_DURATION_MS,
  MOTION_REVEAL_MIN_OPACITY,
  isElementInViewport,
  prefersReducedMotion,
} from "@/lib/motion";

type Props = {
  children: ReactNode;
  className?: string;
  /** Atraso em ms ao entrar na viewport (efeito cascata entre cards). */
  delayMs?: number;
};

export function ScrollReveal({ children, className = "", delayMs = 0 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (prefersReducedMotion()) {
      setRevealed(true);
      return;
    }

    let cancelled = false;
    const reveal = () => {
      if (!cancelled) setRevealed(true);
    };

    if (isElementInViewport(el)) {
      reveal();
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          reveal();
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -4% 0px", threshold: 0.05 },
    );

    observer.observe(el);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, []);

  const style: CSSProperties = {
    ["--reveal-min-opacity" as string]: MOTION_REVEAL_MIN_OPACITY,
    ["--reveal-duration" as string]: `${MOTION_REVEAL_DURATION_MS}ms`,
    transitionDelay: revealed && delayMs > 0 ? `${delayMs}ms` : "0ms",
  };

  return (
    <div
      ref={ref}
      style={style}
      data-revealed={revealed ? "true" : "false"}
      className={`motion-reveal ${className}`.trim()}
    >
      {children}
    </div>
  );
}
