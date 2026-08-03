import { BRAND_STEPS, generateBrandScale } from "@/lib/brand-color-palette";

/** Propriedades CSS para `style` no `<html>` (SSR + cliente). */
export function brandCssProperties(
  primaryHex: string,
  darkHex?: string | null,
): Record<string, string> {
  const scale = generateBrandScale(primaryHex, darkHex);
  const props: Record<string, string> = {
    "--brand-primary": scale[600],
    "--brand-primary-dark": scale[700],
  };
  for (const step of BRAND_STEPS) {
    props[`--brand-${step}`] = scale[step];
  }
  return props;
}
