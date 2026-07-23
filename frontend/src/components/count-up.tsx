"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  value: number;
  singular?: string;
  plural?: string;
  durationMs?: number;
  className?: string;
};

/** Conta de 0 até `value` ao entrar na viewport (ease-out), respeitando prefers-reduced-motion. */
export function CountUp({ value, singular, plural, durationMs = 1000, className = "" }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const run = () => {
      if (started.current) return;
      started.current = true;

      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
        setDisplay(value);
        return;
      }

      const start = performance.now();
      const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

      const tick = (now: number) => {
        const progress = Math.min((now - start) / durationMs, 1);
        setDisplay(Math.round(value * easeOutCubic(progress)));
        if (progress < 1) {
          requestAnimationFrame(tick);
        }
      };
      requestAnimationFrame(tick);
    };

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          run();
          obs.disconnect();
        }
      },
      { rootMargin: "0px 0px 8% 0px", threshold: 0.01 },
    );
    obs.observe(el);

    return () => obs.disconnect();
  }, [value, durationMs]);

  const label = singular && plural ? (value === 1 ? singular : plural) : null;

  return (
    <span ref={ref} className={className}>
      {display.toLocaleString("pt-BR")}
      {label ? ` ${label}` : ""}
    </span>
  );
}
