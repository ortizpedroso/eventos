"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

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
  const [live, setLive] = useState(settings);

  useEffect(() => {
    setLive(settings);
  }, [settings]);

  // Recarrega no cliente para não ficar preso ao cache SSR do layout.
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/public/platform", { cache: "no-store", credentials: "same-origin" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: PlatformSettings | null) => {
        if (!cancelled && data && typeof data.site_name === "string") {
          setLive(data);
        }
      })
      .catch(() => {
        /* mantém SSR */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PlatformSettingsContext.Provider value={live}>{children}</PlatformSettingsContext.Provider>
  );
}

export function usePlatformSettings(): PlatformSettings {
  return useContext(PlatformSettingsContext);
}
