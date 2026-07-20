/** Skeleton global: preenche a célula 1fr do grid durante trocas de página. */
export default function Loading() {
  return (
    <div
      className="flex min-h-full w-full flex-1 flex-col gap-4 py-4"
      aria-busy
      aria-label="Carregando página"
    >
      <div className="h-8 w-2/5 animate-pulse rounded-lg bg-zinc-200/80" />
      <div className="h-4 w-3/5 animate-pulse rounded bg-zinc-200/60" />
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-40 animate-pulse rounded-2xl bg-zinc-200/50" />
        ))}
      </div>
    </div>
  );
}
