"use client";

type OrganizerBrand = {
  brand_primary_color?: string | null;
  brand_primary_color_dark?: string | null;
};

/** Cores da marca do organizador (white-label na página pública). */
export function OrganizerBrandTheme({ brand }: { brand: OrganizerBrand }) {
  const primary = brand.brand_primary_color?.trim();
  const dark = brand.brand_primary_color_dark?.trim();
  if (!primary && !dark) return null;

  const css = `:root {
  ${primary ? `--brand-primary: ${primary};` : ""}
  ${dark ? `--brand-primary-dark: ${dark};` : ""}
}`;

  return <style id="eventosbr-organizer-brand">{css}</style>;
}
