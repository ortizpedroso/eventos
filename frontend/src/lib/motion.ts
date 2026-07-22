/** Tokens compartilhados do sistema de motion (conversão > decoração). */

export const MOTION_REVEAL_MIN_OPACITY = 0.68;
export const MOTION_REVEAL_DURATION_MS = 420;
export const MOTION_HERO_TOTAL_MS = 480;
export const MOTION_HERO_STAGGER_MS = 70;

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function isElementInViewport(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  const vh = window.innerHeight || document.documentElement.clientHeight || 0;
  if (rect.width <= 0 || rect.height <= 0) return false;
  return rect.bottom > 0 && rect.top < vh;
}
