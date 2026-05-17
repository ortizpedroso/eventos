export const EVENTO_CATEGORIAS = [
  "Cultura",
  "Esportes",
  "Tecnologia",
  "Negócios",
  "Educação",
  "Música",
  "Religião",
  "Saúde",
  "Outros",
] as const;

/** Pré-visualização de slug (alinhada à ideia do python-slugify no backend). */
export function slugFromNome(nome: string): string {
  try {
    const s = nome
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return s || "evento";
  } catch {
    return "evento";
  }
}

export function isoToDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** DD/MM/AAAA HHhMM (sem segundos), hora no estilo comum em português. */
export function formatEventoDataHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}h${pad(d.getMinutes())}`;
}
