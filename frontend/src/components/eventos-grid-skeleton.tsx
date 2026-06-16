export function EventosGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => i + 1).map((i) => (
        <div
          key={i}
          className="animate-pulse overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm"
        >
          <div className="aspect-[16/10] w-full bg-zinc-200" />
          <div className="space-y-3 p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="h-5 flex-1 rounded bg-zinc-200" />
              <div className="h-5 w-14 shrink-0 rounded-full bg-zinc-100" />
            </div>
            <div className="h-3 w-3/4 rounded bg-zinc-100" />
            <div className="h-4 w-28 rounded bg-zinc-200" />
          </div>
        </div>
      ))}
    </div>
  );
}
