"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { PlatformSettings } from "@/lib/platform-settings";
import { DEFAULT_PLATFORM_SETTINGS } from "@/lib/platform-settings";

const PlatformSettingsContext = createContext<PlatformSettings>(DEFAULT_PLATFORM_SETTINGS);

export function PlatformSettingsProvider({
  settings,
  children,
}: {
  settings: PlatformSettings;
  children: ReactNode;
}) {
  return (
    <PlatformSettingsContext.Provider value={settings}>{children}</PlatformSettingsContext.Provider>
  );
}

export function usePlatformSettings(): PlatformSettings {
  return useContext(PlatformSettingsContext);
}
