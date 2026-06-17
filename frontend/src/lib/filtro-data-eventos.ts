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
