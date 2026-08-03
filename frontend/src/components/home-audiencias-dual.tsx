import Link from "next/link";

import { CriarEventoLink } from "@/components/criar-evento-link";
import { HomeHeroExplorar } from "@/components/home-hero-explorar";

/**
 * Hero de lançamento: marca + promessa ao organizador (ICP).
 * Comprador tem caminho secundário abaixo — sem competir no primeiro viewport.
 */
export function HomeAudienciasDual() {
  return (
    <div className="mx-auto max-w-6xl">
      <section
        className="relative overflow-hidden rounded-3xl border border-emerald-900/10 bg-zinc-950 text-white shadow-lg"
        aria-labelledby="home-hero-titulo"
      >
        <div
          className="absolute inset-0 bg-cover bg-center opacity-40"
          style={{ backgroundImage: "url(/hero-default.svg)" }}
          aria-hidden
        />
        <div
          className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-zinc-950/90 to-emerald-950/80"
          aria-hidden
        />
        <div className="relative px-6 py-14 text-center sm:px-10 sm:py-16 lg:px-16 lg:py-20">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300/90">
            EventosBR
          </p>
          <h1
            id="home-hero-titulo"
            className="mx-auto mt-4 max-w-3xl text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl"
          >
            Venda ingresso hoje. Receba no painel. Opere o dia sem planilha.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-zinc-200 sm:text-lg">
            Comece grátis. PIX, cartão, check-in com QR e extrato — tudo no mesmo lugar.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <CriarEventoLink className="btn-success px-8 py-3.5 text-base shadow-sm">
              Começar meu evento grátis
            </CriarEventoLink>
            <Link
              href="/eventos"
              className="inline-flex items-center justify-center rounded-md bg-white/10 px-8 py-3.5 text-base font-medium text-white ring-1 ring-inset ring-white/30 transition hover:bg-white/15"
            >
              Explorar eventos
            </Link>
          </div>
          <p className="mt-5 text-sm text-zinc-400">
            Já organiza eventos?{" "}
            <Link href="/produtores" className="font-medium text-emerald-300 underline-offset-2 hover:underline">
              Ver página para produtores
            </Link>
          </p>
        </div>
      </section>

      <section
        className="mt-10 rounded-2xl border border-zinc-200 bg-white px-6 py-8 text-center sm:px-8 sm:text-left"
        aria-labelledby="home-participante-titulo"
      >
        <div className="lg:flex lg:items-start lg:justify-between lg:gap-10">
          <div className="lg:max-w-md">
            <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700">
              Para quem vai ao evento
            </p>
            <h2
              id="home-participante-titulo"
              className="mt-2 text-2xl font-extrabold tracking-tight text-zinc-900 sm:text-3xl"
            >
              Do PIX ao QR Code na entrada — sem dor de cabeça.
            </h2>
            <p className="mt-3 text-base text-zinc-600">
              Compre em minutos. Ingresso no e-mail e na sua conta.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
              <Link href="/eventos" className="btn-success px-6 py-3 text-sm shadow-sm sm:text-base">
                Explorar eventos
              </Link>
              <Link href="/ajuda/como-comprar" className="btn-outline px-6 py-3 text-sm shadow-sm sm:text-base">
                Como comprar
              </Link>
            </div>
          </div>
          <div className="mt-8 lg:mt-0 lg:flex-1">
            <HomeHeroExplorar />
          </div>
        </div>
      </section>
    </div>
  );
}
