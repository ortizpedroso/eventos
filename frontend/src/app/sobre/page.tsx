import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sobre | EventosBR",
  description:
    "Conheça a EventosBR: plataforma de eventos com ingressos, pagamentos seguros e reembolsos para organizadores e participantes.",
};

export default function SobrePage() {
  return (
    <div className="overflow-hidden pb-16 pt-8 sm:pb-24 sm:pt-12 lg:pb-32 lg:pt-16" data-mobile-justify>
      {/* Hero Section */}
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 sm:text-5xl">
          Sobre a <span className="text-emerald-700">EventosBR.</span>
        </h1>
        <p className="mt-6 text-lg text-zinc-600 sm:text-xl">
          Uma plataforma robusta para criar eventos, vender ingressos e receber com segurança —
          com foco em quem produz e em quem participa.
        </p>
      </div>

      {/* Nossa Proposta (Zigue-Zague) */}
      <div className="mx-auto mt-16 max-w-7xl px-4 sm:mt-24 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-12 lg:flex-row lg:items-center">
            <div className="relative flex w-full flex-1 items-center justify-center overflow-hidden rounded-2xl min-h-[320px] ring-1 ring-zinc-200 lg:min-h-[440px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=800&q=80"
                alt="Público em uma grande conferência"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/80 via-zinc-900/10 to-transparent" />
              <div className="absolute bottom-6 left-6 right-6">
                <p className="text-xl font-bold text-white drop-shadow-md sm:text-2xl">
                  Menos planilhas, mais conexões reais.
                </p>
              </div>
            </div>
            <div className="flex-1 lg:max-w-xl">
              <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">A nossa proposta</h2>
              <p className="mt-6 text-lg leading-relaxed text-zinc-600">
                Acreditamos que organizar um evento não deve ser um pesadelo logístico. Queremos reduzir fricção: oferecemos formulários claros, uma página pública otimizada para conversão, pagamentos seguros e regras de cancelamento flexíveis.
              </p>
              <p className="mt-4 text-lg leading-relaxed text-zinc-600">
                O nosso objetivo é devolver o seu tempo. Menos horas lidando com burocracias ou conciliações financeiras, e mais tempo para focar no conteúdo, na experiência e na energia do seu público.
              </p>
            </div>
          </div>
      </div>

      {/* Para quem é (Grid de Cards) */}
      <div className="mx-auto mt-24 max-w-7xl px-4 sm:mt-32 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">Feito para todo o ecossistema</h2>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          <div className="h-full">
            <div className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v11.25A2.25 2.25 0 0018.75 19.5h-13.5a2.25 2.25 0 00-2.25-2.25V6m16.5 0v-.75A2.25 2.25 0 0018.75 3h-13.5A2.25 2.25 0 003 5.25V6m16.5 0H3M9 10.5h6" />
                </svg>
              </div>
              <h3 className="mt-5 text-lg font-semibold text-zinc-900">Produtores</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                Organizadores de shows, festivais, torneios esportivos e feijoadas que buscam autonomia, repasses rápidos e taxas transparentes.
              </p>
            </div>
          </div>

          <div className="h-full">
            <div className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </div>
              <h3 className="mt-5 text-lg font-semibold text-zinc-900">Participantes</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                O seu público final, que exige uma experiência mobile fluida, rapidez no pagamento via PIX ou cartão e máxima segurança nos dados.
              </p>
            </div>
          </div>

          <div className="h-full">
            <div className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                </svg>
              </div>
              <h3 className="mt-5 text-lg font-semibold text-zinc-900">Equipes Tech</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                Desenvolvedores e agências que valorizam uma API bem documentada (OpenAPI) e uma stack moderna para realizar integrações customizadas.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tecnologia (Dark Premium Section) */}
      <div className="mx-auto mt-24 max-w-7xl px-4 sm:mt-32 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-zinc-900 px-6 py-12 shadow-2xl sm:px-12 lg:flex lg:items-center lg:justify-between lg:gap-16 lg:px-16 lg:py-16">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-50" />
            
            <div className="relative z-10 lg:max-w-2xl">
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Tecnologia de alto tráfego</h2>
              <p className="mt-6 text-lg leading-relaxed text-zinc-300">
                Construída para não te deixar na mão no momento da virada de lote. O nosso painel web é desenvolvido em <strong className="text-emerald-400 font-semibold">Next.js e TypeScript</strong> para velocidade máxima. A API roda em <strong className="text-emerald-400 font-semibold">FastAPI</strong> (Python), com arquitetura escalável e pronta para alta concorrência.
              </p>
              <p className="mt-4 text-lg leading-relaxed text-zinc-300">
                Pagamentos e reembolsos passam por um ecossistema financeiro externo robusto, garantindo estabilidade bancária e segurança antifraude global em cada transação processada.
              </p>
            </div>

            <div className="relative z-10 mt-10 w-full max-w-md shrink-0 lg:mt-0 lg:max-w-sm">
              <div className="rounded-xl border border-white/10 bg-black/40 p-6 backdrop-blur-md shadow-2xl">
                <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                  <div className="h-3 w-3 rounded-full bg-red-500/80" />
                  <div className="h-3 w-3 rounded-full bg-amber-500/80" />
                  <div className="h-3 w-3 rounded-full bg-emerald-500/80" />
                </div>
                <div className="mt-5 space-y-2 font-mono text-sm leading-relaxed text-zinc-300">
                  <p><span className="text-pink-400">import</span> {"{ EventosBR }"} <span className="text-pink-400">from</span> <span className="text-emerald-300">&apos;future&apos;</span>;</p>
                  <p className="text-zinc-500 pt-2">// Inicia o motor de vendas</p>
                  <p>EventosBR.<span className="text-blue-300">startSales</span>();</p>
                  <p className="pt-2 text-emerald-400">➜ Vendas a 500 req/s. Stable.</p>
                </div>
              </div>
            </div>
          </div>
      </div>

      {/* CTA Final */}
      <div className="mx-auto mt-24 max-w-3xl px-4 text-center sm:mt-32 sm:px-6">
        <p className="text-sm text-zinc-600">Quer experimentar ou ver preços?</p>
        <div className="mt-4 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:justify-center">
          <Link href="/auth?mode=register" className="btn-success px-6 py-3 text-base shadow-sm">
            Criar conta
          </Link>
          <Link href="/funcionalidades" className="btn-outline px-6 py-3 text-base shadow-sm">
            Funcionalidades
          </Link>
        </div>
      </div>
    </div>
  );
}
