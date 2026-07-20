import Link from "next/link";

export default function EventoLoading() {
  return (
    <div className="space-y-6 py-2">
      <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-600">
        <Link className="hover:underline" href="/eventos">
          ← Voltar aos eventos
        </Link>
      </div>
      <div
        className="-mx-4 h-56 w-[calc(100%+2rem)] rounded-xl bg-zinc-100 sm:-mx-6 sm:h-64 sm:w-[calc(100%+3rem)] lg:-mx-8 lg:h-72 lg:w-[calc(100%+4rem)]"
        aria-hidden
      />
      <div className="grid w-full gap-6 lg:grid-cols-2 lg:items-start">
        <div className="order-2 min-h-[280px] rounded-xl border border-zinc-200 bg-zinc-50 lg:order-1" aria-hidden />
        <div className="order-1 min-h-[360px] rounded-xl border border-zinc-200 bg-zinc-50 lg:order-2" aria-hidden />
      </div>
    </div>
  );
}
