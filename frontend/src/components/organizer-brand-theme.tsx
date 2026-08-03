"use client";

import { useEffect } from "react";

import { applyBrandThemeToDocument } from "@/lib/apply-brand-theme";
import { buildBrandCssBlock } from "@/lib/brand-color-palette";

type OrganizerBrand = {
  brand_primary_color?: string | null;
  brand_primary_color_dark?: string | null;
};

/** Cores da marca do organizador (white-label na página pública). */
export function OrganizerBrandTheme({ brand }: { brand: OrganizerBrand }) {
  const primary = brand.brand_primary_color?.trim() || "";
  const dark = brand.brand_primary_color_dark?.trim() || "";
  const hasBrand = Boolean(primary || dark);
  const primaryHex = primary || "#10b981";
  const css = hasBrand
    ? buildBrandCssBlock(":root", primaryHex, dark || undefined)
    : "";

  useEffect(() => {
    if (!hasBrand) return;
    applyBrandThemeToDocument(primaryHex, dark || undefined);
  }, [hasBrand, primaryHex, dark]);

  if (!hasBrand) return null;

  return <style id="eventosbr-organizer-brand">{css}</style>;
}
