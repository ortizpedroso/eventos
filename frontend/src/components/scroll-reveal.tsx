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

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.06 },
    );
    obs.observe(el);
    return () => obs.disconnect();
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
