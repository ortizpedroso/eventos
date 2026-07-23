import type { Metadata } from "next";
import Link from "next/link";

import { CriarEventoLink } from "@/components/criar-evento-link";
import { categoriaFromQuery } from "@/lib/evento-categorias";
import { filtrarEventosVitrine } from "@/lib/eventos-vitrine";
import { fetchEventosPublicos } from "@/lib/eventos-publicos";

import { EventosListaPublica } from "./eventos-lista-publica";

type PageProps = {
  searchParams: Promise<{ categoria?: string; q?: string; cidade?: string; de?: string; ate?: string }>;
};

function buscaFromQuery(raw: string | undefined): string {
  return raw?.trim() ?? "";
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const sp = await searchParams;
  const categoria = categoriaFromQuery(sp.categoria);
  const q = buscaFromQuery(sp.q);
  if (q) {
    return {
      title: `Busca: ${q} | Eventos | EventosBR`,
      description: `Eventos relacionados a “${q}” na EventosBR.`,
    };
  }
  if (categoria) {
    return {
      title: `${categoria} | Eventos | EventosBR`,
      description: `Eventos de ${categoria} na EventosBR — datas, locais e ingressos com pagamento seguro.`,
    };
  }
  return {
    title: "Eventos | EventosBR",
    description:
      "Descubra eventos publicados na EventosBR: datas, locais e ingressos com pagamento seguro.",
  };
}

export default async function EventosListPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const categoriaInicial = categoriaFromQuery(sp.categoria);
  const buscaInicial = buscaFromQuery(sp.q);
  const cidadeInicial = sp.cidade?.trim() ?? "";
  const deInicial = sp.de?.trim() ?? "";
  const ateInicial = sp.ate?.trim() ?? "";

  let eventosIniciais: Awaited<ReturnType<typeof filtrarEventosVitrine>> = [];
  let fetchInicialOk = true;
  try {
    eventosIniciais = filtrarEventosVitrine(
      await fetchEventosPublicos(50, {
        categoria: categoriaInicial || undefined,
        q: buscaInicial || undefined,
        cidade: cidadeInicial || undefined,
        de: deInicial || undefined,
        ate: ateInicial || undefined,
      }),
    );
  } catch {
    eventosIniciais = [];
    fetchInicialOk = false;
  }

  return (
    <div className="pb-16 pt-8 sm:pb-24 sm:pt-12 lg:pb-32 lg:pt-16 textos-justificados">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 sm:text-5xl">
          {buscaInicial ? (
            <>
              Busca: <span className="text-emerald-700">{buscaInicial}</span>
            </>
          ) : categoriaInicial ? (
            <>
              Eventos de <span className="text-emerald-700">{categoriaInicial}</span>
            </>
          ) : (
            <>
              Encontre seu <span className="text-emerald-700">próximo evento.</span>
            </>
          )}
        </h1>
        <p className="mt-6 text-lg text-zinc-600 sm:text-xl">
          Busque por nome, filtre por categoria e garanta seu ingresso com pagamento seguro.
        </p>
      </div>

      <EventosListaPublica
        initialEventos={eventosIniciais}
        fetchInicialOk={fetchInicialOk}
        initialCategoria={categoriaInicial}
        initialBusca={buscaInicial}
        initialCidade={cidadeInicial}
        initialDe={deInicial}
        initialAte={ateInicial}
      />

      <div className="mx-auto mt-16 max-w-3xl text-center sm:mt-20">
        <p className="text-sm text-zinc-600">Organiza eventos?</p>
        <div className="mt-4 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:justify-center">
          <CriarEventoLink className="btn-success px-6 py-3 text-base shadow-sm">
            Publicar evento
          </CriarEventoLink>
          <Link href="/planos" className="btn-outline px-6 py-3 text-base shadow-sm">
            Ver planos
          </Link>
        </div>
      </div>
    </div>
  );
}
