/** Presets de marca + derivação da escala tonal (50–950) para o tema global. */

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

export const BRAND_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

export type BrandStep = (typeof BRAND_STEPS)[number];

export type BrandScale = Record<BrandStep, string>;

type Rgb = { r: number; g: number; b: number };

function clamp(n: number, min = 0, max = 255): number {
  return Math.min(max, Math.max(min, n));
}

function hexToRgb(hex: string): Rgb | null {
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

function rgbToHsl(rgb: Rgb): { h: number; s: number; l: number } {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      default:
        h = ((r - g) / d + 4) / 6;
    }
  }

  return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }

  const hue2rgb = (p: number, q: number, t: number): number => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  };
}

/** Curva de luminosidade alinhada à escala Tailwind (emerald). */
const STEP_LIGHTNESS: Record<BrandStep, number | null> = {
  50: 0.97,
  100: 0.945,
  200: 0.905,
  300: 0.835,
  400: 0.765,
  500: 0.695,
  600: null,
  700: null,
  800: 0.28,
  900: 0.22,
  950: 0.145,
};

/** Saturação proporcional — tons claros menos saturados. */
const STEP_SATURATION_FACTOR: Record<number, number> = {
  50: 0.55,
  100: 0.6,
  200: 0.65,
  300: 0.7,
  400: 0.75,
  500: 0.8,
  800: 0.88,
  900: 0.92,
  950: 0.95,
};

/**
 * Gera escala tonal proporcional: 600 = primária, 700 = escura; restante por HSL.
 * Classes Tailwind `emerald-*` são remapeadas a estas variáveis em `globals.css`.
 */
export function generateBrandScale(primaryHex: string, darkHex?: string | null): BrandScale {
  const primary = normalizeHexColor(primaryHex, "#10b981");
  const dark = normalizeHexColor(
    darkHex?.trim() || deriveBrandDarkColor(primary),
    deriveBrandDarkColor(primary),
  );

  const primaryRgb = hexToRgb(primary);
  const darkRgb = hexToRgb(dark);
  if (!primaryRgb || !darkRgb) {
    return generateBrandScale("#10b981", "#047857");
  }

  const primaryHsl = rgbToHsl(primaryRgb);
  const darkHsl = rgbToHsl(darkRgb);
  const scale = {} as BrandScale;

  for (const step of [50, 100, 200, 300, 400, 500] as const) {
    const l = STEP_LIGHTNESS[step]!;
    const s = primaryHsl.s * STEP_SATURATION_FACTOR[step];
    const rgb = hslToRgb(primaryHsl.h, s, l);
    scale[step] = rgbToHex(rgb.r, rgb.g, rgb.b);
  }

  scale[600] = primary;
  scale[700] = dark;

  for (const step of [800, 900, 950] as const) {
    const l = STEP_LIGHTNESS[step]!;
    const s = darkHsl.s * STEP_SATURATION_FACTOR[step];
    const rgb = hslToRgb(darkHsl.h, s, l);
    scale[step] = rgbToHex(rgb.r, rgb.g, rgb.b);
  }

  return scale;
}

export const DEFAULT_BRAND_SCALE = generateBrandScale("#10b981", "#047857");

/** Linhas CSS `--brand-*` para injeção em `:root`. */
export function buildBrandCssVariables(primaryHex: string, darkHex?: string | null): string {
  const scale = generateBrandScale(primaryHex, darkHex);
  const lines = [
    `--brand-primary: ${scale[600]};`,
    `--brand-primary-dark: ${scale[700]};`,
    ...BRAND_STEPS.map((step) => `--brand-${step}: ${scale[step]};`),
  ];
  return lines.join("\n  ");
}

export function buildBrandCssBlock(selector: string, primaryHex: string, darkHex?: string | null): string {
  return `${selector} {\n  ${buildBrandCssVariables(primaryHex, darkHex)}\n}`;
}
