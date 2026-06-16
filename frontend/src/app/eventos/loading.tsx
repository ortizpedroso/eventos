export default function EventosLoading() {
  return (
    <div className="animate-pulse pb-16 pt-8 sm:pb-24 sm:pt-12">
      <div className="mx-auto max-w-3xl text-center">
        <div className="mx-auto h-10 w-64 rounded-lg bg-zinc-200 sm:h-12 sm:w-80" />
        <div className="mx-auto mt-6 h-4 max-w-xl rounded bg-zinc-100" />
        <div className="mx-auto mt-2 h-4 max-w-lg rounded bg-zinc-100" />
      </div>
      <div className="mx-auto mt-16 grid max-w-6xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
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
    </div>
  );
}
