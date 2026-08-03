"use client";

import type { PlatformSettings } from "@/lib/platform-settings";
import { buildBrandCssBlock } from "@/lib/brand-color-palette";

type Props = {
  settings: PlatformSettings;
};

/** Injeta escala tonal da marca (white-label) — classes `emerald-*` seguem via @theme. */
export function PlatformTheme({ settings }: Props) {
  const css = buildBrandCssBlock(
    ":root",
    settings.primary_color,
    settings.primary_color_dark,
  );

  return <style id="eventosbr-platform-theme">{css}</style>;
}
