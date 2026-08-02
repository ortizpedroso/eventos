import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { HomeAudienciasDual } from "@/components/home-audiencias-dual";
import { HomeDepoimentos } from "@/components/home-depoimentos";
import { HomeDiferenciais } from "@/components/home-diferenciais";
import { HomeEventosDestaque } from "@/components/home-eventos-destaque";
import { HomeFaq } from "@/components/home-faq";
import { HomeHeroVisual } from "@/components/home-hero-visual";
import { HomeProvaSocial } from "@/components/home-prova-social";
import { HomeProdutorFeatures } from "@/components/home-produtor-features";
import { HomeSelosConfianca } from "@/components/home-selos-confianca";
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
      <div className="reveal">
        <HomeHeroVisual eventos={eventosHero} />
      </div>
      <div className="reveal">
        <HomeEventosDestaque initialEventos={eventosDestaque} />
      </div>
    </>
  );
}

export default function Home() {
  return (
    <div className="pb-16 pt-8 sm:pb-24 sm:pt-12 lg:pb-32 lg:pt-16 textos-justificados">
      <div className="reveal">
        <HomeAudienciasDual />
      </div>

      <Suspense fallback={null}>
        <div className="reveal mx-auto mt-10 max-w-3xl">
          <HomeProvaSocial />
        </div>
      </Suspense>

      <div className="reveal mx-auto mt-10 max-w-3xl">
        <HomeSelosConfianca />
      </div>

      <HomeProdutorFeatures />

      <Suspense fallback={null}>
        <HomeEventosDinamicos />
      </Suspense>

      <HomeDiferenciais />

      <HomeDepoimentos />

      <div className="reveal mx-auto mt-24 max-w-6xl sm:mt-32">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl">
            Preços simples e transparentes.
          </h2>
          <p className="mt-4 text-lg text-zinc-600">
            Comece de graça, venda com taxa por ingresso ou reduza ainda mais as taxas com assinatura.
          </p>
          <Link
            href="/planos"
            className="mt-4 inline-block text-sm font-medium text-emerald-700 underline-offset-2 hover:underline"
          >
            Ver detalhes em Planos →
          </Link>
        </div>
        <PlanosPricingCards />
      </div>

      <HomeFaq />

      <div className="reveal mx-auto mt-16 max-w-3xl sm:mt-20">
        <div className="rounded-2xl border border-emerald-600 bg-white p-6 shadow-md ring-1 ring-emerald-600 sm:p-8">
          <h2 className="text-lg font-semibold text-emerald-700">Transparência e segurança</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            Pagamentos via PIX e cartão com taxas estimadas visíveis nos simuladores. Reembolso
            automático dentro do prazo legal em Minha conta.{" "}
            <Link href="/termos" className="font-medium text-emerald-700 hover:underline">Termos</Link> e{" "}
            <Link href="/privacidade" className="font-medium text-emerald-700 hover:underline">
              Privacidade
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
