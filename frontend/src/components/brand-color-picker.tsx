"use client";

import {
  BRAND_COLOR_PRESETS,
  deriveBrandDarkColor,
  normalizeHexColor,
} from "@/lib/brand-color-palette";

type Props = {
  primary: string;
  primaryDark: string;
  onChange: (primary: string, primaryDark: string) => void;
  primaryLabel?: string;
  darkLabel?: string;
};

export function BrandColorPicker({
  primary,
  primaryDark,
  onChange,
  primaryLabel = "Cor principal",
  darkLabel = "Cor escura (hover)",
}: Props) {
  const primaryNorm = normalizeHexColor(primary, "#10b981");
  const darkNorm = normalizeHexColor(primaryDark, deriveBrandDarkColor(primaryNorm));

  function setPrimary(next: string) {
    const p = normalizeHexColor(next, primaryNorm);
    onChange(p, deriveBrandDarkColor(p));
  }

  return (
    <div className="space-y-4 sm:col-span-2">
      <div>
        <span className="text-sm font-medium text-zinc-800">{primaryLabel}</span>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="color"
            value={primaryNorm}
            onChange={(e) => setPrimary(e.target.value)}
            className="h-10 w-12 shrink-0 cursor-pointer rounded border border-zinc-300 bg-white p-0.5"
            aria-label={primaryLabel}
          />
          <input
            className="input font-mono w-28 shrink-0"
            value={primaryNorm}
            onChange={(e) => setPrimary(e.target.value)}
            aria-label={`${primaryLabel} (hex)`}
          />
          <div className="flex flex-wrap gap-1.5">
            {BRAND_COLOR_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                title={preset.label}
                className="h-8 w-8 rounded-md border border-zinc-200 shadow-sm ring-offset-2 transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                style={{ backgroundColor: preset.primary }}
                onClick={() => onChange(preset.primary, preset.dark)}
              />
            ))}
          </div>
        </div>
        <p className="mt-1.5 text-xs text-zinc-500">
          Clique em uma cor da paleta ou ajuste manualmente — a cor escura é calculada automaticamente.
        </p>
      </div>
      <div>
        <span className="text-sm font-medium text-zinc-800">{darkLabel}</span>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="color"
            value={darkNorm}
            onChange={(e) => onChange(primaryNorm, normalizeHexColor(e.target.value, darkNorm))}
            className="h-10 w-12 shrink-0 cursor-pointer rounded border border-zinc-300 bg-white p-0.5"
            aria-label={darkLabel}
          />
          <input
            className="input font-mono w-28 shrink-0"
            value={darkNorm}
            onChange={(e) =>
              onChange(primaryNorm, normalizeHexColor(e.target.value, deriveBrandDarkColor(primaryNorm)))
            }
            aria-label={`${darkLabel} (hex)`}
          />
        </div>
      </div>
    </div>
  );
}
