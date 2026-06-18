export type FiltroDataPreset = "" | "hoje" | "fim_de_semana" | "semana";

export function intervaloFiltroData(preset: FiltroDataPreset): { de?: string; ate?: string } {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);

  if (preset === "hoje") {
    const s = startOfDay(now);
    return { de: s.toISOString(), ate: endOfDay(now).toISOString() };
  }

  if (preset === "fim_de_semana") {
    const day = now.getDay();
    const satOffset = day === 6 ? 0 : day === 0 ? -1 : 6 - day;
    const sat = new Date(now);
    sat.setDate(now.getDate() + satOffset);
    const sun = new Date(sat);
    sun.setDate(sat.getDate() + (day === 0 ? 0 : 1));
    return { de: startOfDay(sat).toISOString(), ate: endOfDay(sun).toISOString() };
  }

  if (preset === "semana") {
    const mon = new Date(now);
    const diff = (mon.getDay() + 6) % 7;
    mon.setDate(mon.getDate() - diff);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return { de: startOfDay(mon).toISOString(), ate: endOfDay(sun).toISOString() };
  }

  return {};
}

function isoDateKey(iso: string): string {
  return iso.slice(0, 10);
}

/** Infere chip ativo a partir de ?de=&ate= na URL. */
export function presetFromDeAte(de?: string | null, ate?: string | null): FiltroDataPreset {
  if (!de?.trim() || !ate?.trim()) return "";
  const deKey = isoDateKey(de.trim());
  const ateKey = isoDateKey(ate.trim());
  const presets: FiltroDataPreset[] = ["hoje", "fim_de_semana", "semana"];
  for (const p of presets) {
    const exp = intervaloFiltroData(p);
    if (exp.de && exp.ate && isoDateKey(exp.de) === deKey && isoDateKey(exp.ate) === ateKey) {
      return p;
    }
  }
  return "";
}

/** Converte ISO da URL para valor de `<input type="date">` (YYYY-MM-DD). */
export function isoToDateInputValue(iso?: string | null): string {
  if (!iso?.trim()) return "";
  const d = iso.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : "";
}

/** Converte datas do seletor customizado em intervalo ISO para a API. */
export function dateInputToIntervalo(de: string, ate: string): { de?: string; ate?: string } {
  const deTrim = de.trim();
  const ateTrim = ate.trim();
  if (!deTrim || !ateTrim) return {};
  const start = new Date(`${deTrim}T00:00:00`);
  const end = new Date(`${ateTrim}T23:59:59`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return {};
  if (start > end) return {};
  return { de: start.toISOString(), ate: end.toISOString() };
}

/** True quando ?de=&ate= não corresponde a nenhum chip preset. */
export function ehIntervaloCustomizado(de?: string | null, ate?: string | null): boolean {
  if (!de?.trim() || !ate?.trim()) return false;
  return presetFromDeAte(de, ate) === "";
}
