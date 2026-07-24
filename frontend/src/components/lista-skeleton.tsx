export function ListaSkeleton({ linhas = 3 }: { linhas?: number }) {
  return (
    <div className="space-y-3" role="status" aria-live="polite" aria-label="Carregando">
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="h-4 w-2/3 rounded bg-zinc-200" />
          <div className="mt-3 h-3 w-1/2 rounded bg-zinc-100" />
          <div className="mt-2 h-3 w-1/3 rounded bg-zinc-100" />
        </div>
      ))}
      <span className="sr-only">Carregando conteúdo…</span>
    </div>
  );
}
