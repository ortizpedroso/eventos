"use client";

import type { ReactNode } from "react";

import { buildScopedBrandCss } from "@/lib/brand-css-style";

type OrganizerBrand = {
  brand_primary_color?: string | null;
  brand_primary_color_dark?: string | null;
};

const SCOPE = "eventosbr-organizer-scope";

/**
 * Whitelabel do organizador — cores só no conteúdo envolvido.
 * Não aplica em `:root` / documento (home, admin e resto do site intactos).
 */
export function OrganizerBrandTheme({
  brand,
  children,
}: {
  brand: OrganizerBrand;
  children: ReactNode;
}) {
  const primary = brand.brand_primary_color?.trim() || "";
  const dark = brand.brand_primary_color_dark?.trim() || "";
  const hasBrand = Boolean(primary || dark);
  const primaryHex = primary || "#10b981";
  const css = hasBrand
    ? buildScopedBrandCss(`.${SCOPE}`, primaryHex, dark || undefined)
    : "";

  const nonce =
    typeof document !== "undefined"
      ? document.querySelector('meta[name="csp-nonce"]')?.getAttribute("content") || undefined
      : undefined;

  return (
    <>
      {hasBrand ? (
        <style id="eventosbr-organizer-brand" nonce={nonce}>
          {css}
        </style>
      ) : null}
      <div className={hasBrand ? SCOPE : undefined}>{children}</div>
    </>
  );
}
