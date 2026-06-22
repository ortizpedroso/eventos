import { EventosGridSkeleton } from "@/components/eventos-grid-skeleton";

function FiltrosShell() {
  return (
    <div
      className="mb-8 space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5"
      aria-hidden
    >
      <div className="h-10 rounded-lg bg-zinc-100" />
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-8 w-24 rounded-full bg-zinc-100" />
        ))}
      </div>
      <div className="h-20 rounded-lg bg-zinc-50" />
    </div>
  );
}

export default function EventosLoading() {
  return (
    <div className="pb-16 pt-8 sm:pb-24 sm:pt-12 lg:pb-32 lg:pt-16">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 sm:text-5xl">
          Encontre seu <span className="text-emerald-700">próximo evento.</span>
        </h1>
        <p className="mt-6 text-lg text-zinc-600 sm:text-xl">
          Busque por nome, filtre por categoria e garanta seu ingresso com pagamento seguro.
        </p>
      </div>
      <div className="mx-auto mt-16 max-w-6xl sm:mt-20">
        <FiltrosShell />
        <EventosGridSkeleton />
      </div>
    </div>
  );
}
