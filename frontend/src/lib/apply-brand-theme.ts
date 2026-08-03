import {
  BRAND_THEME_CHANNEL,
  brandCssProperties,
  type BrandThemeMessage,
} from "@/lib/brand-css-style";

/** Aplica escala de marca no `<html>` imediatamente (sem esperar re-render). */
export function applyBrandThemeToDocument(
  primaryHex: string,
  darkHex?: string | null,
  root: HTMLElement | { style: { setProperty: (k: string, v: string) => void } } = document.documentElement,
  opts?: { broadcast?: boolean },
): void {
  const props = brandCssProperties(primaryHex, darkHex);
  for (const [key, value] of Object.entries(props)) {
    root.style.setProperty(key, value);
  }

  // Atualiza <style id="eventosbr-platform-theme"> se existir (cascade extra)
  if (typeof document !== "undefined") {
    const tag = document.getElementById("eventosbr-platform-theme");
    if (tag) {
      const lines = Object.entries(props)
        .map(([k, v]) => `${k}: ${v};`)
        .join("\n  ");
      tag.textContent = `:root, html {\n  ${lines}\n}`;
    }
  }

  if (opts?.broadcast !== false && typeof BroadcastChannel !== "undefined") {
    try {
      const msg: BrandThemeMessage = {
        primary: props["--brand-600"],
        dark: props["--brand-700"],
      };
      const bc = new BroadcastChannel(BRAND_THEME_CHANNEL);
      bc.postMessage(msg);
      bc.close();
    } catch {
      /* ignore */
    }
  }
}
