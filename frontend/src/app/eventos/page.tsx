import type { Metadata } from "next";
import Link from "next/link";

import { apiFetch } from "@/lib/api";
import { authHrefParaCriarEvento } from "@/lib/criar-evento-routes";
import type { Evento } from "@/lib/types";

export const metadata: Metadata = {
  title: "Eventos | EventosBR",
  description:
    "Descubra eventos publicados na EventosBR: datas, locais e ingressos com pagamento seguro.",
};

export default async function EventosListPage() {
  let eventos: Evento[] = [];
  let fetchError: string | null = null;
  try {
    eventos = await apiFetch<Evento[]>("/api/eventos/", {
      next: { revalidate: 30 },
    });
  } catch {
    fetchError = "Não foi possível carregar a lista agora. Tente novamente em instantes.";
  }

  return (
    <div className="py-16 sm:py-24 lg:py-32">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 sm:text-5xl">
          Eventos em <span className="text-emerald-700">destaque.</span>
        </h1>
        <p className="mt-6 text-lg text-zinc-600 sm:text-xl">
          Explore o que está acontecendo. Todos os eventos aqui estão publicados e prontos para
          inscrição ou compra de ingresso.
        </p>
      </div>

      <div className="mx-auto mt-16 max-w-4xl sm:mt-20">
        {fetchError ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-center text-sm text-red-800">
            {fetchError}
          </div>
        ) : null}

        {!fetchError && eventos.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
            <p className="text-sm text-zinc-600">
              Ainda não há eventos publicados. Seja o primeiro a criar um.
            </p>
            <div className="mt-6 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:justify-center">
              <Link href={authHrefParaCriarEvento()} className="btn-success px-6 py-3 text-base shadow-sm">
                Criar evento
              </Link>
              <Link href="/auth?mode=register" className="btn-outline px-6 py-3 text-base shadow-sm">
                Criar conta
              </Link>
            </div>
          </div>
        ) : null}

        {!fetchError && eventos.length > 0 ? (
          <ul className="grid grid-cols-1 gap-6 text-left sm:grid-cols-2 lg:gap-8">
            {eventos.map((e) => {
              const fmtInicio = new Date(e.data_inicio).toLocaleString("pt-BR", {
                dateStyle: "short",
                timeStyle: "short",
              });
              const fmtFim = new Date(e.data_fim).toLocaleString("pt-BR", {
                dateStyle: "short",
                timeStyle: "short",
              });
              const preco = e.preco_ingresso.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              });
              const resumo =
                e.descricao.length > 140 ? `${e.descricao.slice(0, 140).trim()}…` : e.descricao;

              return (
                <li key={e.id}>
                  <Link
                    href={`/eventos/${e.slug}`}
                    className="block h-full rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition-colors hover:border-emerald-600 hover:shadow-md hover:ring-1 hover:ring-emerald-600 sm:p-8"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h2 className="text-lg font-semibold text-zinc-900">{e.nome}</h2>
                      <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700">
                        {e.categoria}
                      </span>
                    </div>
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-zinc-600">{resumo}</p>
                    <div className="mt-4 space-y-1 text-xs text-zinc-500">
                      <p>
                        <span className="font-medium text-zinc-700">Início:</span> {fmtInicio}
                      </p>
                      <p>
                        <span className="font-medium text-zinc-700">Fim:</span> {fmtFim}
                      </p>
                      <p>
                        <span className="font-medium text-zinc-700">Local:</span> {e.local}
                      </p>
                    </div>
                    <p className="mt-4 text-sm font-semibold text-emerald-800">A partir de {preco}</p>
                    <span className="mt-4 inline-block text-sm font-medium text-emerald-700">
                      Ver detalhes →
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

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
