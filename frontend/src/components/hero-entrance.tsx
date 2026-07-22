"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import {
  MOTION_HERO_STAGGER_MS,
  MOTION_HERO_TOTAL_MS,
  prefersReducedMotion,
} from "@/lib/motion";

const HeroEntranceCtx = createContext(false);

type ItemProps = {
  children: ReactNode;
  className?: string;
};

export function HeroEntrance({ children, className = "" }: { children: ReactNode; className?: string }) {
  const [active, setActive] = useState(false);

  useLayoutEffect(() => {
    if (prefersReducedMotion()) {
      setActive(true);
      return;
    }
    const id = requestAnimationFrame(() => setActive(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <HeroEntranceCtx.Provider value={active}>
      <div
        className={`hero-entrance ${className}`.trim()}
        data-hero-active={active ? "true" : "false"}
        style={
          {
            ["--hero-total" as string]: `${MOTION_HERO_TOTAL_MS}ms`,
            ["--hero-stagger" as string]: `${MOTION_HERO_STAGGER_MS}ms`,
          } as CSSProperties
        }
      >
        {children}
      </div>
    </HeroEntranceCtx.Provider>
  );
}

export function HeroEntranceItem({ children, className = "" }: ItemProps) {
  const active = useContext(HeroEntranceCtx);
  const ref = useRef<HTMLDivElement>(null);
  const [order, setOrder] = useState(0);

  useLayoutEffect(() => {
    const host = ref.current?.closest("[data-hero-active]");
    if (!host || !ref.current) return;
    const items = host.querySelectorAll("[data-hero-item]");
    const index = Array.from(items).indexOf(ref.current);
    if (index >= 0) setOrder(index);
  }, []);

  return (
    <div
      ref={ref}
      data-hero-item
      data-hero-active={active ? "true" : "false"}
      style={{ ["--hero-order" as string]: order } as CSSProperties}
      className={`hero-entrance__item ${className}`.trim()}
    >
      {children}
    </div>
  );
}
