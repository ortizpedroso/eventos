"use client";

import { PlatformTheme } from "@/components/platform-theme";
import { usePlatformSettings } from "@/components/platform-settings-provider";

/** Tema da plataforma reativo — atualiza após refresh client-side das settings. */
export function PlatformThemeLive() {
  const settings = usePlatformSettings();
  return <PlatformTheme settings={settings} />;
}
