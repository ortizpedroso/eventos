/** Presets de marca + derivação da cor escura (hover/links) por paleta. */

export type BrandColorPreset = {
  id: string;
  label: string;
  primary: string;
  dark: string;
};

export const BRAND_COLOR_PRESETS: BrandColorPreset[] = [
  { id: "emerald", label: "Verde", primary: "#10b981", dark: "#047857" },
  { id: "teal", label: "Teal", primary: "#14b8a6", dark: "#0f766e" },
  { id: "blue", label: "Azul", primary: "#2563eb", dark: "#1d4ed8" },
  { id: "indigo", label: "Índigo", primary: "#4f46e5", dark: "#3730a3" },
  { id: "violet", label: "Violeta", primary: "#7c3aed", dark: "#5b21b6" },
  { id: "rose", label: "Rosa", primary: "#e11d48", dark: "#be123c" },
  { id: "orange", label: "Laranja", primary: "#ea580c", dark: "#c2410c" },
  { id: "amber", label: "Âmbar", primary: "#d97706", dark: "#b45309" },
  { id: "slate", label: "Grafite", primary: "#475569", dark: "#334155" },
  { id: "zinc", label: "Neutro", primary: "#52525b", dark: "#3f3f46" },
];

function clamp(n: number, min = 0, max = 255): number {
  return Math.min(max, Math.max(min, n));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.replace(/^#/, "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((c) => clamp(c).toString(16).padStart(2, "0")).join("")}`;
}

/** Cor escura harmonizada: escurece ~22% mantendo matiz (hover / links). */
export function deriveBrandDarkColor(primaryHex: string, fallback = "#047857"): string {
  const rgb = hexToRgb(primaryHex);
  if (!rgb) return fallback;
  const factor = 0.78;
  return rgbToHex(
    Math.round(rgb.r * factor),
    Math.round(rgb.g * factor),
    Math.round(rgb.b * factor),
  );
}

export function normalizeHexColor(value: string, fallback: string): string {
  const v = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
  if (/^[0-9a-fA-F]{6}$/.test(v)) return `#${v.toLowerCase()}`;
  return fallback;
}
