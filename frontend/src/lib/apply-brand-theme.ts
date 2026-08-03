import { BRAND_STEPS, generateBrandScale } from "@/lib/brand-color-palette";

/** Aplica escala de marca no `:root` imediatamente (sem esperar re-render). */
export function applyBrandThemeToDocument(
  primaryHex: string,
  darkHex?: string | null,
  root: HTMLElement = document.documentElement,
): void {
  const scale = generateBrandScale(primaryHex, darkHex);
  root.style.setProperty("--brand-primary", scale[600]);
  root.style.setProperty("--brand-primary-dark", scale[700]);
  for (const step of BRAND_STEPS) {
    root.style.setProperty(`--brand-${step}`, scale[step]);
  }
}
