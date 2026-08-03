import Link from "next/link";

import { CriarEventoLink } from "@/components/criar-evento-link";
import { HomeHeroExplorar } from "@/components/home-hero-explorar";

/**
 * Hero de lançamento (v1.50.1): fundo claro + verde da marca + foto de evento.
 * Foto stock (grátis) em `/marketing/hero-evento.webp`:
 * Unsplash — show ao vivo (palco, sóbrio) `photo-1464375117522-1311d6a5b81f`
 * https://unsplash.com — trocar pelo arquivo real no mesmo path depois.
 */
export function HomeAudienciasDual() {
  return (
    <div>
      {/* Full-bleed: sai do max-w-7xl + padding do <main> */}
      <section
        className="relative left-1/2 isolate w-screen max-w-[100vw] -translate-x-1/2 overflow-hidden border-b border-emerald-100 bg-[#f7faf8] text-zinc-900 -mt-6"
        aria-labelledby="home-hero-titulo"
      >
        {/* Foto full-bleed (stock — substituir no mesmo path) */}
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <picture>
            <source srcSet="/marketing/hero-evento.webp" type="image/webp" />
            <img
              src="/marketing/hero-evento.jpg"
              alt=""
              className="h-full w-full object-cover object-[center_30%] opacity-90"
              width={1920}
              height={1080}
              decoding="async"
              fetchPriority="high"
            />
          </picture>
          {/* Wash forte à esquerda: texto escuro legível; foto respira à direita */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#f7faf8] from-0% via-[#f7faf8]/95 via-40% to-transparent to-75%" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#f7faf8] via-transparent to-[#f7faf8]/55" />
          <div
            className="absolute -left-16 top-1/3 h-80 w-80 rounded-full bg-emerald-300/25 blur-3xl"
            aria-hidden
          />
        </div>

        <div className="relative mx-auto flex min-h-[min(86vh,42rem)] w-full max-w-7xl flex-col justify-center px-4 py-16 text-left sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-800">
            EventosBR
          </p>
          <h1
            id="home-hero-titulo"
            className="mt-4 max-w-2xl text-3xl font-extrabold tracking-tight text-zinc-950 sm:text-4xl lg:text-5xl lg:leading-[1.1]"
          >
            Venda ingresso hoje. Receba no painel. Opere o dia sem planilha.
          </h1>
          <p className="mt-5 max-w-xl text-base text-zinc-700 sm:text-lg">
            Comece grátis. PIX, cartão, check-in com QR e extrato — tudo no mesmo lugar.
          </p>
          <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <CriarEventoLink className="btn-success px-8 py-3.5 text-base shadow-sm">
              Começar meu evento grátis
            </CriarEventoLink>
            <Link
              href="/eventos"
              className="inline-flex items-center justify-center rounded-md border border-emerald-800/25 bg-white/90 px-8 py-3.5 text-base font-medium text-emerald-950 shadow-sm transition hover:border-emerald-800/40 hover:bg-white"
            >
              Explorar eventos
            </Link>
          </div>
          <p className="mt-5 text-sm text-zinc-600">
            Já organiza eventos?{" "}
            <Link
              href="/produtores"
              className="font-medium text-emerald-800 underline-offset-2 hover:underline"
            >
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
              <Link
                href="/ajuda/como-comprar"
                className="btn-outline px-6 py-3 text-sm shadow-sm sm:text-base"
              >
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
