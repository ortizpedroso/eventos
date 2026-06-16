"use client";

import Link from "next/link";

import { EventoCategoriasChips } from "@/components/evento-categorias-chips";
import { EVENTO_CATEGORIAS_DESTAQUE } from "@/lib/evento-categorias";

export function HomeHeroExplorar() {
  return (
    <div className="mx-auto mt-10 w-full max-w-2xl">
      <p className="text-center text-sm font-medium text-zinc-600">O que você procura?</p>
      <EventoCategoriasChips
        categorias={EVENTO_CATEGORIAS_DESTAQUE}
        layout="wrap"
        className="mt-3 justify-center"
        ariaLabel="Explorar eventos por categoria"
      />
      <p className="mt-4 text-center text-sm text-zinc-500">
        <Link
          href="/eventos"
          className="font-medium text-emerald-800 underline-offset-2 hover:underline"
        >
          Ver todos os eventos e buscar por nome
        </Link>
      </p>
    </div>
  );
}
