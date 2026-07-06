import type { Metadata } from "next";
import Link from "next/link";
import { ScrollReveal } from "@/components/scroll-reveal";
import { HomeDepoimentos } from "@/components/home-depoimentos";
import { HomeHeroExplorar } from "@/components/home-hero-explorar";
import { HomeEventosDestaque } from "@/components/home-eventos-destaque";
import { HomeProvaSocial } from "@/components/home-prova-social";
import { HomeSelosConfianca } from "@/components/home-selos-confianca";
import { authHrefParaCriarEvento } from "@/lib/criar-evento-routes";
import { filtrarEventosVitrine } from "@/lib/eventos-vitrine";
import { eventosDestaqueHome, fetchEventosPublicos } from "@/lib/eventos-publicos";
import { homeMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = homeMetadata;

export default async function Home() {
  let eventosDestaque = null;
  try {
    const todos = await fetchEventosPublicos(24);
    eventosDestaque = eventosDestaqueHome(filtrarEventosVitrine(todos));
  } catch {
    eventosDestaque = null;
  }

  return (
    <div className="pb-16 pt-8 sm:pb-24 sm:pt-12 lg:pb-32 lg:pt-16">
      {/* Hero Section */}
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700">
          Ingressos · PIX · QR Code na entrada
        </p>
        <h1 className="mt-3 text-5xl font-extrabold tracking-tight text-zinc-900 sm:text-6xl">
          Venda e compre ingressos{" "}
          <span className="text-emerald-700">sem complicação.</span>
        </h1>
        <p className="mt-6 text-lg text-zinc-700 sm:text-xl">
          A plataforma brasileira para organizadores e participantes: publique em minutos,
          aceite PIX e cartão, repasse direto na sua conta e check-in inteligente na portaria.
        </p>

        <HomeHeroExplorar />

        <HomeProvaSocial />

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link href="/eventos" className="btn-success px-8 py-3.5 text-base shadow-sm">
            Ver eventos
          </Link>
          <Link href={authHrefParaCriarEvento()} className="btn-outline px-8 py-3.5 text-base shadow-sm">
            Organizar um evento
          </Link>
        </div>
      </div>

      <HomeEventosDestaque initialEventos={eventosDestaque} />

      <HomeDepoimentos />

      <HomeSelosConfianca />

      {/* Pricing Section (Cards) */}
      <div className="mx-auto mt-24 max-w-6xl sm:mt-32">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl">
            Preços simples e transparentes.
          </h2>
          <p className="mt-4 text-lg text-zinc-700">
            Comece de graça, venda com taxa por ingresso ou reduza ainda mais as taxas com assinatura.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 text-left lg:grid-cols-3 lg:gap-8">
          {/* Plano Gratuito */}
          <ScrollReveal className="h-full" delayMs={0}>
          <div className="h-full rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
            <h3 className="text-xl font-semibold text-zinc-900">Eventos Gratuitos</h3>
            <p className="mt-2 text-sm text-zinc-600">Perfeito para eventos comunitários, ações solidárias e encontros.</p>
            <div className="mt-6 flex items-baseline gap-x-1">
              <span className="text-4xl font-bold tracking-tight text-zinc-900">R$ 0</span>
              <span className="text-sm font-semibold text-zinc-600">/ingresso</span>
            </div>
            <ul className="mt-8 space-y-3 text-sm text-zinc-700">
              <li className="flex gap-x-3">✅ Eventos ilimitados</li>
              <li className="flex gap-x-3">✅ Ingressos gratuitos ilimitados</li>
              <li className="flex gap-x-3">✅ QR Code na entrada</li>
            </ul>
            <div className="mt-8">
              <Link href={authHrefParaCriarEvento()} className="btn-outline w-full">Criar conta grátis</Link>
            </div>
          </div>
          </ScrollReveal>

          {/* Plano por uso (pago) */}
          <ScrollReveal className="h-full" delayMs={90}>
          <div className="h-full rounded-2xl border border-emerald-600 bg-white p-8 shadow-md ring-1 ring-emerald-600">
            <h3 className="text-xl font-semibold text-emerald-800">Eventos Pagos</h3>
            <p className="mt-2 text-sm text-zinc-600">Para shows, feijoadas, torneios, festas e produtores profissionais.</p>
            <div className="mt-6 flex flex-wrap items-baseline gap-x-1 gap-y-1">
              <span className="text-4xl font-bold tracking-tight text-zinc-900">8%</span>
              <span className="text-sm font-semibold text-zinc-600">
                + R$ 0,50 /ingresso vendido
              </span>
            </div>
            <ul className="mt-8 space-y-3 text-sm text-zinc-700">
              <li className="flex gap-x-3">✅ Cartão, PIX e pagamentos seguros</li>
              <li className="flex gap-x-3">✅ Reembolso automatizado</li>
              <li className="flex gap-x-3">✅ Recebimento direto na conta</li>
            </ul>
            <div className="mt-8">
              <Link href={authHrefParaCriarEvento()} className="btn-success w-full text-white">Começar a vender</Link>
            </div>
          </div>
          </ScrollReveal>

          {/* Assinatura */}
          <ScrollReveal className="h-full" delayMs={180}>
          <div className="h-full rounded-2xl border border-emerald-800 bg-gradient-to-b from-emerald-50/80 to-white p-8 shadow-md ring-2 ring-emerald-800">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
              Mais lucro
            </p>
            <h3 className="mt-1 text-xl font-semibold text-emerald-900">
              Aumente seus lucros com uma assinatura
            </h3>
            <p className="mt-2 text-sm text-zinc-700">
              Para quem vende volume e quer taxa menor por ingresso, com mensalidade fixa.
            </p>
            <div className="mt-6 space-y-2">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-2xl font-bold tracking-tight text-zinc-900">R$ 500,00</span>
                <span className="text-sm font-semibold text-zinc-600">/mês</span>
              </div>
              <p className="text-xs font-medium text-emerald-900">Mensalidade</p>
              <div className="pt-2 flex flex-wrap items-baseline gap-x-1 gap-y-1 border-t border-emerald-200/80">
                <span className="text-3xl font-bold tracking-tight text-zinc-900">6%</span>
                <span className="text-sm font-semibold text-zinc-600">
                  + R$ 0,30 /ingresso vendido
                </span>
              </div>
              <p className="text-xs font-medium text-emerald-900">Taxa sobre vendas</p>
            </div>
            <ul className="mt-8 space-y-3 text-sm text-zinc-700">
              <li className="flex gap-x-3">✅ Taxa reduzida em cada venda</li>
              <li className="flex gap-x-3">✅ Mesmos recursos do plano pago</li>
              <li className="flex gap-x-3">✅ Indicado para alto volume de ingressos</li>
            </ul>
            <div className="mt-8">
              <Link href={authHrefParaCriarEvento()} className="btn-success w-full text-white">
                Quero assinar
              </Link>
            </div>
          </div>
          </ScrollReveal>
        </div>
      </div>

      <div className="mx-auto mt-16 max-w-3xl sm:mt-20">
        <ScrollReveal>
        <div className="rounded-2xl border border-emerald-600 bg-white p-6 shadow-md ring-1 ring-emerald-600 sm:p-8">
          <h2 className="text-lg font-semibold text-emerald-800">Transparência e segurança</h2>
          <p className="mt-3 text-justify text-sm leading-6 text-zinc-700">
            Abrir conta no EventosBR é gratuito e sem mensalidade obrigatória. Quando você vende
            ingressos pagos, as taxas aplicam-se só sobre o que realmente entra no caixa. O
            pagamento é processado por gateways com padrão de segurança internacional, e os cancelamentos 
            respeitam os prazos e condições que você configurar para cada evento.
          </p>
          <p className="mt-4 text-justify text-sm leading-6 text-zinc-700">
            Assim você mantém previsibilidade na operação e quem compra entende as regras do
            evento — do primeiro clique ao possível reembolso, com clareza para os dois lados.
          </p>
        </div>
        </ScrollReveal>
      </div>
    </div>
  );
}
