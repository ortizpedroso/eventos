import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">404</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
        Não encontramos o que você procurou
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-zinc-600">
        A página pode ter sido removida ou o endereço está incorreto.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link href="/" className="btn-primary">
          Ir para o início
        </Link>
        <Link href="/eventos" className="btn-outline">
          Explorar eventos
        </Link>
      </div>
    </div>
  );
}
