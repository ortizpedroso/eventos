"use client";

import type { PlatformSettings } from "@/lib/platform-settings";

type Props = {
  settings: PlatformSettings;
};

/** Injeta cores da marca (white-label) em CSS variables. */
export function PlatformTheme({ settings }: Props) {
  const css = `:root {
  --brand-primary: ${settings.primary_color};
  --brand-primary-dark: ${settings.primary_color_dark};
}`;

  return <style id="eventosbr-platform-theme">{css}</style>;
}
