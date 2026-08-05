"use client";

import { useEffect } from "react";

import type { PlatformSettings } from "@/lib/platform-settings";
import { applyBrandThemeToDocument } from "@/lib/apply-brand-theme";
import { BRAND_THEME_CHANNEL, buildBrandRootCss, type BrandThemeMessage } from "@/lib/brand-css-style";

type Props = {
  settings: PlatformSettings;
};

/** Injeta escala tonal no `:root`/`html` e escuta mudanças de outras abas. */
export function PlatformTheme({ settings }: Props) {
  const css = buildBrandRootCss(settings.primary_color, settings.primary_color_dark);

  useEffect(() => {
    applyBrandThemeToDocument(settings.primary_color, settings.primary_color_dark, document.documentElement, {
      broadcast: false,
    });
  }, [settings.primary_color, settings.primary_color_dark]);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const bc = new BroadcastChannel(BRAND_THEME_CHANNEL);
    bc.onmessage = (ev: MessageEvent<BrandThemeMessage>) => {
      const data = ev.data;
      if (!data?.primary) return;
      applyBrandThemeToDocument(data.primary, data.dark, document.documentElement, {
        broadcast: false,
      });
    };
    return () => bc.close();
  }, []);

  const nonce =
    typeof document !== "undefined"
      ? document.querySelector('meta[name="csp-nonce"]')?.getAttribute("content") || undefined
      : undefined;

  return (
    <style id="eventosbr-platform-theme" nonce={nonce}>
      {css}
    </style>
  );
}
