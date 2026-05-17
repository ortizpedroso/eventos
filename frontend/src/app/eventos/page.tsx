import type { Metadata } from "next";
import Link from "next/link";

import { authHrefParaCriarEvento } from "@/lib/criar-evento-routes";

import { EventosListaPublica } from "./eventos-lista-publica";

export const metadata: Metadata = {
  title: "Eventos | EventosBR",
  description:
    "Descubra eventos publicados na EventosBR: datas, locais e ingressos com pagamento seguro.",
};

export default function EventosListPage() {
  return (
    <div className="pb-16 pt-8 sm:pb-24 sm:pt-12 lg:pb-32 lg:pt-16">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 sm:text-5xl">
          Eventos em <span className="text-emerald-700">destaque.</span>
        </h1>
        <p className="mt-6 text-lg text-zinc-600 sm:text-xl">
          De shows que agitam a cidade a encontros que criam conexões, aqui você encontra a sua próxima experiência.
          Navegue, descubra e garanta seu lugar.
        </p>
      </div>

      <EventosListaPublica />

      <div className="mx-auto mt-16 max-w-3xl text-center sm:mt-20">
        <p className="text-sm text-zinc-600">Organiza eventos?</p>
        <div className="mt-4 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:justify-center">
          <Link href={authHrefParaCriarEvento()} className="btn-success px-6 py-3 text-base shadow-sm">
            Publicar evento
          </Link>
          <Link href="/planos" className="btn-outline px-6 py-3 text-base shadow-sm">
            Ver planos
          </Link>
        </div>
      </div>
    </div>
  );
}
