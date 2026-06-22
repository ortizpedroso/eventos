import { EventosGridSkeleton } from "@/components/eventos-grid-skeleton";

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
        <EventosGridSkeleton />
      </div>
    </div>
  );
}
