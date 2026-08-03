"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { applyBrandThemeToDocument } from "@/lib/apply-brand-theme";
import type { PlatformSettings } from "@/lib/platform-settings";
import { DEFAULT_PLATFORM_SETTINGS } from "@/lib/platform-settings";

type PlatformSettingsContextValue = {
  settings: PlatformSettings;
  /** Atualiza settings e aplica tema de marca imediatamente no documento. */
  replaceSettings: (settings: PlatformSettings) => void;
  patchSettings: (patch: Partial<PlatformSettings>) => void;
};

const PlatformSettingsContext = createContext<PlatformSettingsContextValue>({
  settings: DEFAULT_PLATFORM_SETTINGS,
  replaceSettings: () => {},
  patchSettings: () => {},
});

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

  const replaceSettings = useCallback((next: PlatformSettings) => {
    setLive(next);
    if (typeof document !== "undefined") {
      applyBrandThemeToDocument(next.primary_color, next.primary_color_dark);
    }
  }, []);

  const patchSettings = useCallback(
    (patch: Partial<PlatformSettings>) => {
      setLive((prev) => {
        const next = { ...prev, ...patch };
        if (typeof document !== "undefined") {
          applyBrandThemeToDocument(
            next.primary_color,
            next.primary_color_dark,
          );
        }
        return next;
      });
    },
    [],
  );

  // Recarrega no cliente para não ficar preso ao cache SSR do layout.
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/public/platform", { cache: "no-store", credentials: "same-origin" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: PlatformSettings | null) => {
        if (!cancelled && data && typeof data.site_name === "string") {
          replaceSettings(data);
        }
      })
      .catch(() => {
        /* mantém SSR */
      });
    return () => {
      cancelled = true;
    };
  }, [replaceSettings]);

  const value = useMemo(
    () => ({ settings: live, replaceSettings, patchSettings }),
    [live, replaceSettings, patchSettings],
  );

  return (
    <PlatformSettingsContext.Provider value={value}>
      {children}
    </PlatformSettingsContext.Provider>
  );
}

export function usePlatformSettings(): PlatformSettings {
  return useContext(PlatformSettingsContext).settings;
}

export function usePlatformSettingsMutator(): Pick<
  PlatformSettingsContextValue,
  "replaceSettings" | "patchSettings"
> {
  const { replaceSettings, patchSettings } = useContext(PlatformSettingsContext);
  return { replaceSettings, patchSettings };
}
