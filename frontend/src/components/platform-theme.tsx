"use client";

import { useEffect } from "react";

import type { PlatformSettings } from "@/lib/platform-settings";
import { applyBrandThemeToDocument } from "@/lib/apply-brand-theme";
import { buildBrandCssBlock } from "@/lib/brand-color-palette";

type Props = {
  settings: PlatformSettings;
};

/** Injeta escala tonal no `:root` e aplica no documento para atualização imediata. */
export function PlatformTheme({ settings }: Props) {
  const css = buildBrandCssBlock(
    ":root",
    settings.primary_color,
    settings.primary_color_dark,
  );

  useEffect(() => {
    applyBrandThemeToDocument(settings.primary_color, settings.primary_color_dark);
  }, [settings.primary_color, settings.primary_color_dark]);

  return <style id="eventosbr-platform-theme">{css}</style>;
}
