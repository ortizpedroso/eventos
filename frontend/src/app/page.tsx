import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { HomeDepoimentos } from "@/components/home-depoimentos";
import { HomeDiferenciais } from "@/components/home-diferenciais";
import { HomeHeroExplorar } from "@/components/home-hero-explorar";
import { HomeEventosDestaque } from "@/components/home-eventos-destaque";
import { HomeHeroVisual } from "@/components/home-hero-visual";
import { HomeProvaSocial } from "@/components/home-prova-social";
import { HomeSelosConfianca } from "@/components/home-selos-confianca";
import { CriarEventoLink } from "@/components/criar-evento-link";
import { PlanosPricingCards } from "@/components/planos-pricing-cards";
import { filtrarEventosVitrine } from "@/lib/eventos-vitrine";
import { eventosDestaqueHome, fetchEventosPublicos } from "@/lib/eventos-publicos";
import { homeMetadata } from "@/lib/site-metadata";
import type { Evento } from "@/lib/types";

export const metadata: Metadata = homeMetadata;

async function HomeEventosDinamicos() {
  let eventosDestaque: Evento[] | null = null;
  let eventosHero: Evento[] | null = null;
  try {
    const todos = filtrarEventosVitrine(await fetchEventosPublicos(24));
    eventosDestaque = eventosDestaqueHome(todos);
    eventosHero = todos;
  } catch {
    eventosDestaque = null;
    eventosHero = null;
  }

  return (
    <>
      <HomeHeroVisual eventos={eventosHero} />
      <HomeEventosDestaque initialEventos={eventosDestaque} />
    </>
  );
}

export default function Home() {
  return (
    <div className="pb-16 pt-8 sm:pb-24 sm:pt-12 lg:pb-32 lg:pt-16 textos-justificados">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700">
          PIX, cartão e QR Code na entrada
        </p>
        <h1 className="mt-3 text-5xl font-extrabold tracking-tight text-zinc-900 sm:text-6xl">
          Venda ingressos sem complicação.{" "}
          <span className="text-emerald-700">Compre em minutos.</span>
        </h1>
        <p className="mt-6 text-lg text-zinc-700 sm:text-xl">
          Publique seu evento em minutos, receba com repasse direto na sua conta e ofereça
          reembolso automático ao seu público — tudo em um só lugar, sem mensalidade obrigatória.
        </p>

        <HomeHeroExplorar />

        <Suspense fallback={null}>
          <HomeProvaSocial />
        </Suspense>

        <HomeSelosConfianca />

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link href="/eventos" className="btn-success px-8 py-3.5 text-base shadow-sm">
            Explorar eventos
          </Link>
          <CriarEventoLink className="btn-outline px-8 py-3.5 text-base shadow-sm">
            Organizar um evento
          </CriarEventoLink>
        </div>
      </div>

      <Suspense fallback={null}>
        <HomeEventosDinamicos />
      </Suspense>

      <HomeDiferenciais />

      <HomeDepoimentos />

      <div className="mx-auto mt-24 max-w-6xl sm:mt-32">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl">
            Preços simples e transparentes.
          </h2>
          <p className="mt-4 text-lg text-zinc-600">
            Comece de graça, venda com taxa por ingresso ou reduza ainda mais as taxas com assinatura.
          </p>
          <Link href="/planos" className="mt-4 inline-block text-sm font-medium text-emerald-800 underline-offset-2 hover:underline">
            Ver detalhes em Planos →
          </Link>
        </div>
        <PlanosPricingCards />
      </div>

      <div className="mx-auto mt-16 max-w-3xl sm:mt-20">
        <div className="rounded-2xl border border-emerald-600 bg-white p-6 shadow-md ring-1 ring-emerald-600 sm:p-8">
          <h2 className="text-lg font-semibold text-emerald-700">Transparência e segurança</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            Pagamentos via PIX e cartão com taxas estimadas visíveis nos simuladores.
            Reembolso automático dentro do prazo legal em Minha conta.
          </p>
        </div>
      </div>
    </div>
  );
}
