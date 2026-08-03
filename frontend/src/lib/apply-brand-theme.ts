import { brandCssProperties } from "@/lib/brand-css-style";

/** Aplica escala de marca no `:root` / `<html>` imediatamente (sem esperar re-render). */
export function applyBrandThemeToDocument(
  primaryHex: string,
  darkHex?: string | null,
  root: HTMLElement = document.documentElement,
): void {
  const props = brandCssProperties(primaryHex, darkHex);
  for (const [key, value] of Object.entries(props)) {
    root.style.setProperty(key, value);
  }
}
