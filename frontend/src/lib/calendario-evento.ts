/** Links para adicionar evento ao calendário. */

export function urlGoogleCalendar(opts: {
  titulo: string;
  inicio: string;
  fim?: string;
  local?: string;
  descricao?: string;
}): string {
  const start = new Date(opts.inicio);
  const end = opts.fim ? new Date(opts.fim) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: opts.titulo,
    dates: `${fmt(start)}/${fmt(end)}`,
  });
  if (opts.local) params.set("location", opts.local);
  if (opts.descricao) params.set("details", opts.descricao.slice(0, 900));
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function urlIcsDownload(opts: {
  titulo: string;
  inicio: string;
  fim?: string;
  local?: string;
  descricao?: string;
}): string {
  const start = new Date(opts.inicio);
  const end = opts.fim ? new Date(opts.fim) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//EventosBR//PT",
    "BEGIN:VEVENT",
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${opts.titulo.replace(/\n/g, " ")}`,
    opts.local ? `LOCATION:${opts.local.replace(/\n/g, " ")}` : "",
    opts.descricao ? `DESCRIPTION:${opts.descricao.replace(/\n/g, " ").slice(0, 500)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join("\r\n"))}`;
}

export function compartilharTextoEvento(opts: {
  nome: string;
  url: string;
  dataFmt?: string;
}): string {
  const partes = [`${opts.nome}`, opts.dataFmt, opts.url].filter(Boolean);
  return partes.join(" — ");
}
