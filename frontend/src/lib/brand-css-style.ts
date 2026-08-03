import { BRAND_STEPS, generateBrandScale } from "@/lib/brand-color-palette";

/** Canal para sincronizar tema da plataforma entre abas. */
export const BRAND_THEME_CHANNEL = "eventosbr-brand-theme";

export type BrandThemeMessage = {
  primary: string;
  dark: string;
};

/** Propriedades CSS para `style` no `<html>` (SSR + cliente) — tema da plataforma. */
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
    props[`--color-emerald-${step}`] = scale[step];
  }
  return props;
}

/** Bloco CSS global `:root`/`html` (tema da plataforma). */
export function buildBrandRootCss(primaryHex: string, darkHex?: string | null): string {
  const props = brandCssProperties(primaryHex, darkHex);
  const body = Object.entries(props)
    .map(([k, v]) => `${k}: ${v};`)
    .join("\n  ");
  return `:root, html {\n  ${body}\n}`;
}

/**
 * Bloco CSS com escopo (whitelabel do organizador).
 * Não altera o tema global do site — só descendentes do seletor.
 */
export function buildScopedBrandCss(
  selector: string,
  primaryHex: string,
  darkHex?: string | null,
): string {
  const props = brandCssProperties(primaryHex, darkHex);
  const body = Object.entries(props)
    .map(([k, v]) => `${k}: ${v};`)
    .join("\n  ");
  return `${selector} {\n  ${body}\n}`;
}
