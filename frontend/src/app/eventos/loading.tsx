export default function EventosLoading() {
  return (
    <div className="animate-pulse py-16 sm:py-24">
      <div className="mx-auto max-w-3xl text-center">
        <div className="mx-auto h-10 w-64 rounded-lg bg-zinc-200 sm:h-12 sm:w-80" />
        <div className="mx-auto mt-6 h-4 max-w-xl rounded bg-zinc-100" />
        <div className="mx-auto mt-2 h-4 max-w-lg rounded bg-zinc-100" />
      </div>
      <div className="mx-auto mt-16 grid max-w-4xl grid-cols-1 gap-6 sm:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl border border-zinc-100 bg-zinc-50 p-6 sm:p-8">
            <div className="h-5 w-full max-w-sm rounded bg-zinc-200" />
            <div className="mt-4 h-3 w-full rounded bg-zinc-100" />
            <div className="mt-2 h-3 w-5/6 rounded bg-zinc-100" />
            <div className="mt-6 h-3 w-1/2 rounded bg-zinc-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
