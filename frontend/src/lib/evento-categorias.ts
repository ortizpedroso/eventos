/** Categorias canônicas — espelham `app/utils/evento_categorias.py`. */
export const EVENTO_CATEGORIAS = [
  "Cultura",
  "Esportes",
  "Tecnologia",
  "Negócios",
  "Educação",
  "Música",
  "Religião",
  "Saúde",
  "Gastronomia",
  "Festas e Baladas",
  "Infantil e Família",
  "Feiras e Exposições",
  "Comunidade e Causas",
  "Workshops e Oficinas",
  "Outros",
] as const;

export type EventoCategoria = (typeof EVENTO_CATEGORIAS)[number];

/** Destaques na navbar e na home — categorias com maior demanda no Brasil. */
export const EVENTO_CATEGORIAS_DESTAQUE: EventoCategoria[] = [
  "Música",
  "Gastronomia",
  "Esportes",
  "Festas e Baladas",
  "Tecnologia",
  "Cultura",
  "Infantil e Família",
  "Workshops e Oficinas",
];

/** Subconjunto compacto para o menu de navegação. */
export const EVENTO_CATEGORIAS_NAV: EventoCategoria[] = [
  "Música",
  "Gastronomia",
  "Esportes",
  "Tecnologia",
  "Cultura",
  "Infantil e Família",
];

export type CategoriaVisual = {
  badge: string;
  chip: string;
  chipAtivo: string;
  hero: string;
  icon: string;
};

const META: Record<EventoCategoria, CategoriaVisual> = {
  Cultura: {
    badge: "bg-violet-100 text-violet-800 ring-violet-200/80",
    chip: "bg-violet-50 text-violet-800 ring-violet-200/70 hover:bg-violet-100",
    chipAtivo: "bg-violet-600 text-white ring-violet-700 shadow-sm",
    hero: "bg-violet-500/20 text-violet-100 ring-violet-300/40",
    icon: "M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128Zm0 0a15.364 15.364 0 0 1-3.844 5.027M15 8.25a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  },
  Esportes: {
    badge: "bg-orange-100 text-orange-800 ring-orange-200/80",
    chip: "bg-orange-50 text-orange-800 ring-orange-200/70 hover:bg-orange-100",
    chipAtivo: "bg-orange-600 text-white ring-orange-700 shadow-sm",
    hero: "bg-orange-500/20 text-orange-100 ring-orange-300/40",
    icon: "M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0 1 16.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.023 6.023 0 0 1-1.77.715m1.77-.715a6.023 6.023 0 0 0 1.77.715",
  },
  Tecnologia: {
    badge: "bg-sky-100 text-sky-800 ring-sky-200/80",
    chip: "bg-sky-50 text-sky-800 ring-sky-200/70 hover:bg-sky-100",
    chipAtivo: "bg-sky-600 text-white ring-sky-700 shadow-sm",
    hero: "bg-sky-500/20 text-sky-100 ring-sky-300/40",
    icon: "M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25",
  },
  Negócios: {
    badge: "bg-indigo-100 text-indigo-800 ring-indigo-200/80",
    chip: "bg-indigo-50 text-indigo-800 ring-indigo-200/70 hover:bg-indigo-100",
    chipAtivo: "bg-indigo-600 text-white ring-indigo-700 shadow-sm",
    hero: "bg-indigo-500/20 text-indigo-100 ring-indigo-300/40",
    icon: "M20.25 14.15v4.25c0 .414-.336.75-.75.75h-4.5a.75.75 0 0 1-.75-.75v-4.25m0 0h4.125c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9 9 9 0 0 0-9 9v1.875c0 .621.504 1.125 1.125 1.125H4.5m0 0h.008v.008H4.5v-.008Zm0 3.75h.008v.008H4.5v-.008Zm0 3.75h.008v.008H4.5v-.008Z",
  },
  Educação: {
    badge: "bg-amber-100 text-amber-900 ring-amber-200/80",
    chip: "bg-amber-50 text-amber-900 ring-amber-200/70 hover:bg-amber-100",
    chipAtivo: "bg-amber-600 text-white ring-amber-700 shadow-sm",
    hero: "bg-amber-500/20 text-amber-100 ring-amber-300/40",
    icon: "M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25",
  },
  Música: {
    badge: "bg-rose-100 text-rose-800 ring-rose-200/80",
    chip: "bg-rose-50 text-rose-800 ring-rose-200/70 hover:bg-rose-100",
    chipAtivo: "bg-rose-600 text-white ring-rose-700 shadow-sm",
    hero: "bg-rose-500/20 text-rose-100 ring-rose-300/40",
    icon: "M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.591.454a2.25 2.25 0 0 1-2.163-1.632V9.75m0 0V6.75m0 3.75L9 9m10.5 0L9 12.75",
  },
  Religião: {
    badge: "bg-purple-100 text-purple-800 ring-purple-200/80",
    chip: "bg-purple-50 text-purple-800 ring-purple-200/70 hover:bg-purple-100",
    chipAtivo: "bg-purple-600 text-white ring-purple-700 shadow-sm",
    hero: "bg-purple-500/20 text-purple-100 ring-purple-300/40",
    icon: "M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75Z",
  },
  Saúde: {
    badge: "bg-teal-100 text-teal-800 ring-teal-200/80",
    chip: "bg-teal-50 text-teal-800 ring-teal-200/70 hover:bg-teal-100",
    chipAtivo: "bg-teal-600 text-white ring-teal-700 shadow-sm",
    hero: "bg-teal-500/20 text-teal-100 ring-teal-300/40",
    icon: "M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z",
  },
  Gastronomia: {
    badge: "bg-red-100 text-red-800 ring-red-200/80",
    chip: "bg-red-50 text-red-800 ring-red-200/70 hover:bg-red-100",
    chipAtivo: "bg-red-600 text-white ring-red-700 shadow-sm",
    hero: "bg-red-500/20 text-red-100 ring-red-300/40",
    icon: "M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.87c1.355 0 2.697.055 4.024.165C17.155 8.51 18 9.473 18 10.608v2.513M12 8.25V6.375c0-.621-.504-1.125-1.125-1.125S9.75 5.754 9.75 6.375V8.25m0 0H8.25m3.75 0h1.5m-1.5 0v3.375m0-3.375h-1.5m1.5 0H15m-3.75 0v3.375m0 0h1.5m-1.5 0H9.75m1.5 0v3.375m0 0h-1.5m1.5 0H15",
  },
  "Festas e Baladas": {
    badge: "bg-fuchsia-100 text-fuchsia-800 ring-fuchsia-200/80",
    chip: "bg-fuchsia-50 text-fuchsia-800 ring-fuchsia-200/70 hover:bg-fuchsia-100",
    chipAtivo: "bg-fuchsia-600 text-white ring-fuchsia-700 shadow-sm",
    hero: "bg-fuchsia-500/20 text-fuchsia-100 ring-fuchsia-300/40",
    icon: "M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z",
  },
  "Infantil e Família": {
    badge: "bg-cyan-100 text-cyan-800 ring-cyan-200/80",
    chip: "bg-cyan-50 text-cyan-800 ring-cyan-200/70 hover:bg-cyan-100",
    chipAtivo: "bg-cyan-600 text-white ring-cyan-700 shadow-sm",
    hero: "bg-cyan-500/20 text-cyan-100 ring-cyan-300/40",
    icon: "M15.182 15.182a4.5 4.5 0 0 1-6.364 0M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Z",
  },
  "Feiras e Exposições": {
    badge: "bg-stone-200 text-stone-800 ring-stone-300/80",
    chip: "bg-stone-100 text-stone-800 ring-stone-300/70 hover:bg-stone-200",
    chipAtivo: "bg-stone-700 text-white ring-stone-800 shadow-sm",
    hero: "bg-stone-500/25 text-stone-100 ring-stone-300/40",
    icon: "M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21",
  },
  "Comunidade e Causas": {
    badge: "bg-lime-100 text-lime-900 ring-lime-200/80",
    chip: "bg-lime-50 text-lime-900 ring-lime-200/70 hover:bg-lime-100",
    chipAtivo: "bg-lime-700 text-white ring-lime-800 shadow-sm",
    hero: "bg-lime-500/20 text-lime-100 ring-lime-300/40",
    icon: "M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z",
  },
  "Workshops e Oficinas": {
    badge: "bg-yellow-100 text-yellow-900 ring-yellow-200/80",
    chip: "bg-yellow-50 text-yellow-900 ring-yellow-200/70 hover:bg-yellow-100",
    chipAtivo: "bg-yellow-600 text-white ring-yellow-700 shadow-sm",
    hero: "bg-yellow-500/20 text-yellow-100 ring-yellow-300/40",
    icon: "M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M9.879 16.121A3 3 0 1 0 12.015 11L11 14H9c0 .768.293 1.536.879 2.121Z",
  },
  Outros: {
    badge: "bg-zinc-100 text-zinc-700 ring-zinc-200/80",
    chip: "bg-zinc-50 text-zinc-700 ring-zinc-200/70 hover:bg-zinc-100",
    chipAtivo: "bg-zinc-700 text-white ring-zinc-800 shadow-sm",
    hero: "bg-white/10 text-zinc-100 ring-white/15",
    icon: "M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z M6 6h.008v.008H6V6Z",
  },
};

export function resolverMetaCategoria(categoria: string): CategoriaVisual {
  if (categoria in META) return META[categoria as EventoCategoria];
  return META.Outros;
}

export function categoriaFromQuery(raw: string | undefined | null): string {
  const s = raw?.trim();
  if (!s) return "";
  if ((EVENTO_CATEGORIAS as readonly string[]).includes(s)) return s;
  return "";
}

export function urlEventosPorCategoria(categoria: string): string {
  if (!categoria) return "/eventos";
  return `/eventos?categoria=${encodeURIComponent(categoria)}`;
}

/** Lista para filtros: canônicas + valores legados ainda no banco. */
export function categoriasParaFiltro(
  eventos: { categoria?: string | null }[] | null | undefined,
): string[] {
  const legadas = new Set<string>();
  for (const e of eventos ?? []) {
    if (e.categoria && !(EVENTO_CATEGORIAS as readonly string[]).includes(e.categoria)) {
      legadas.add(e.categoria);
    }
  }
  return [...EVENTO_CATEGORIAS, ...[...legadas].sort((a, b) => a.localeCompare(b, "pt-BR"))];
}
