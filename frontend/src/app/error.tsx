"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">Erro</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
        Algo deu errado
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-zinc-600">
        Não foi possível carregar esta página. Tente novamente ou volte ao início.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button type="button" onClick={reset} className="btn-primary">
          Tentar novamente
        </button>
        <Link href="/" className="btn-outline">
          Ir para o início
        </Link>
      </div>
    </div>
  );
}
