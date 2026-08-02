import Link from "next/link";

import { CriarEventoLink } from "@/components/criar-evento-link";
import { HomeHeroExplorar } from "@/components/home-hero-explorar";

/**
 * Separação explícita na home: participante (comprar) × organizador (criar evento).
 * Mantém comprador como jornada principal sem misturar CTAs no mesmo bloco.
 */
export function HomeAudienciasDual() {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
        <section
          className="rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm sm:p-8 lg:text-left"
          aria-labelledby="home-participante-titulo"
        >
          <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700">
            Para participantes
          </p>
          <h1
            id="home-participante-titulo"
            className="mt-3 text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl"
          >
            Encontre o evento.{" "}
            <span className="text-emerald-700">Compre em minutos.</span>
          </h1>
          <p className="mt-4 text-base text-zinc-700 sm:text-lg">
            PIX ou cartão, QR Code na entrada e ingressos organizados em Minha conta.
          </p>
          <HomeHeroExplorar />
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
            <Link href="/eventos" className="btn-success px-8 py-3.5 text-base shadow-sm">
              Explorar eventos
            </Link>
            <Link href="/ajuda/como-comprar" className="btn-outline px-8 py-3.5 text-base shadow-sm">
              Como comprar
            </Link>
          </div>
        </section>

        <section
          className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6 text-center shadow-sm sm:p-8 lg:text-left"
          aria-labelledby="home-organizador-titulo"
        >
          <p className="text-sm font-semibold uppercase tracking-wider text-emerald-800">
            Para organizadores
          </p>
          <h2
            id="home-organizador-titulo"
            className="mt-3 text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl"
          >
            Crie seu evento, venda ingressos e gerencie tudo em um só lugar.
          </h2>
          <p className="mt-4 text-base text-zinc-700 sm:text-lg">
            Pagamentos, check-in, financeiro e relatórios — sem planilhas e sem misturar com a
            jornada de quem só quer comprar.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
            <CriarEventoLink className="btn-success px-8 py-3.5 text-base shadow-sm">
              Começar meu evento grátis
            </CriarEventoLink>
            <Link href="/produtores" className="btn-outline px-8 py-3.5 text-base shadow-sm">
              Sou produtor
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
