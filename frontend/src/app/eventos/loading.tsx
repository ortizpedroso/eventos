export default function EventosLoading() {
  return (
    <div className="animate-pulse pb-16 pt-8 sm:pb-24 sm:pt-12">
      <div className="mx-auto max-w-3xl text-center">
        <div className="mx-auto h-10 w-64 rounded-lg bg-zinc-200 sm:h-12 sm:w-80" />
        <div className="mx-auto mt-6 h-4 max-w-xl rounded bg-zinc-100" />
        <div className="mx-auto mt-2 h-4 max-w-lg rounded bg-zinc-100" />
      </div>
      <div className="mx-auto mt-16 grid max-w-4xl grid-cols-1 gap-6 sm:grid-cols-2 lg:gap-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="-mx-6 -mt-6 mb-4 overflow-hidden rounded-t-2xl border-b border-zinc-100 sm:-mx-8 sm:-mt-8">
              <div className="aspect-video w-full bg-zinc-200" />
            </div>
            <div className="flex items-start justify-between gap-4">
              <div className="h-6 flex-1 rounded bg-zinc-200" />
              <div className="h-5 w-16 shrink-0 rounded-full bg-zinc-100" />
            </div>
            <div className="mt-4 space-y-2">
              <div className="h-4 w-full rounded bg-zinc-100" />
              <div className="h-4 w-4/5 rounded bg-zinc-100" />
              <div className="h-4 w-2/3 rounded bg-zinc-100" />
            </div>
            <div className="mt-6 space-y-2">
              <div className="h-3 w-1/2 rounded bg-zinc-100" />
              <div className="h-3 w-1/3 rounded bg-zinc-100" />
            </div>
            <div className="mt-auto pt-6">
              <div className="h-5 w-32 rounded bg-zinc-200" />
              <div className="mt-4 h-4 w-24 rounded bg-zinc-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
