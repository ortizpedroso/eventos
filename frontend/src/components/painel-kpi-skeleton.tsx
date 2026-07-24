/** Placeholder de KPIs/gráficos — mesma altura aproximada do conteúdo real (sem piscada). */
export function PainelKpiSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-live="polite" aria-label="Carregando indicadores">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
          >
            <div className="h-3 w-24 rounded bg-zinc-200" />
            <div className="mt-3 h-8 w-20 rounded bg-zinc-200" />
            <div className="mt-2 h-3 w-full max-w-[12rem] rounded bg-zinc-100" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="h-4 w-40 rounded bg-zinc-200" />
        <div className="mt-4 flex h-32 items-end gap-2">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex-1 rounded-t bg-zinc-100" style={{ height: `${30 + (i % 4) * 15}%` }} />
          ))}
        </div>
      </div>
      <span className="sr-only">Carregando indicadores…</span>
    </div>
  );
}
