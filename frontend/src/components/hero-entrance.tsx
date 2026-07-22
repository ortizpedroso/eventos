import type { CSSProperties, ReactNode } from "react";

import { MOTION_HERO_STAGGER_MS, MOTION_HERO_TOTAL_MS } from "@/lib/motion";

type ItemProps = {
  children: ReactNode;
  className?: string;
  /** Ordem no stagger (0 = primeiro). */
  order?: number;
};

export function HeroEntrance({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`hero-entrance ${className}`.trim()}
      style={
        {
          ["--hero-total" as string]: `${MOTION_HERO_TOTAL_MS}ms`,
          ["--hero-stagger" as string]: `${MOTION_HERO_STAGGER_MS}ms`,
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}

export function HeroEntranceItem({ children, className = "", order = 0 }: ItemProps) {
  return (
    <div
      className={`hero-entrance__item ${className}`.trim()}
      style={{ ["--hero-order" as string]: order } as CSSProperties}
    >
      {children}
    </div>
  );
}
