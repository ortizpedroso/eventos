import type { Metadata } from "next";
import Link from "next/link";
import { ScrollReveal } from "@/components/scroll-reveal";
import { authHrefParaCriarEvento } from "@/lib/criar-evento-routes";

export const metadata: Metadata = {
  title: "Planos | EventosBR",
  description:
    "Preços transparentes: eventos gratuitos, taxa por ingresso vendido ou assinatura com taxa reduzida no EventosBR.",
};

const brl = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Exemplo ilustrativo: 1.000 ingressos a R$ 50 no mês. */
const EX_INGRESSOS = 1000;
const EX_PRECO = 50;
const exArrecadacao = EX_INGRESSOS * EX_PRECO;
const exTaxaSemAssinatura = exArrecadacao * 0.1 + 2 * EX_INGRESSOS;
const exTaxaComAssinatura = 500 + exArrecadacao * 0.08 + 1.5 * EX_INGRESSOS;
const exLiquidoSem = exArrecadacao - exTaxaSemAssinatura;
const exLiquidoCom = exArrecadacao - exTaxaComAssinatura;
const exEconomia = exLiquidoCom - exLiquidoSem;

export default function PlanosPage() {
  return (
    <div className="py-16 sm:py-24 lg:py-32">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 sm:text-5xl">
          Planos para cada tipo de <span className="text-emerald-700">evento.</span>
        </h1>
        <p className="mt-6 text-lg text-zinc-600 sm:text-xl">
          Sem mensalidade obrigatória para começar. Venda ingressos pagos com taxa por venda ou,
          se preferir, assine um plano mensal com taxa menor em cada ingresso.
        </p>
      </div>

      <div className="mx-auto mt-16 max-w-6xl sm:mt-20">
        <div className="grid grid-cols-1 gap-6 text-left lg:grid-cols-3 lg:gap-8">
          <ScrollReveal className="h-full" delayMs={0}>
          <div className="h-full rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
            <h2 className="text-xl font-semibold text-zinc-900">Eventos gratuitos</h2>
            <p className="mt-2 text-sm text-zinc-500">
              Meetups, comunidades e eventos sem cobrança de ingresso.
            </p>
            <div className="mt-6 flex items-baseline gap-x-1">
              <span className="text-4xl font-bold tracking-tight text-zinc-900">R$ 0</span>
              <span className="text-sm font-semibold text-zinc-600">/ingresso</span>
            </div>
            <ul className="mt-8 space-y-3 text-sm text-zinc-600">
              <li className="flex gap-x-3">✅ Eventos ilimitados</li>
              <li className="flex gap-x-3">✅ Ingressos gratuitos ilimitados</li>
              <li className="flex gap-x-3">✅ QR Code na entrada</li>
              <li className="flex gap-x-3">✅ Cadastro de participantes</li>
            </ul>
            <div className="mt-8">
              <Link href="/auth?mode=register" className="btn-outline w-full">
                Criar conta grátis
              </Link>
            </div>
          </div>
          </ScrollReveal>

          <ScrollReveal className="h-full" delayMs={90}>
          <div className="h-full rounded-2xl border border-emerald-600 bg-white p-8 shadow-md ring-1 ring-emerald-600">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Mais vendas
            </p>
            <h2 className="mt-1 text-xl font-semibold text-emerald-700">Eventos pagos</h2>
            <p className="mt-2 text-sm text-zinc-500">
              Produções profissionais, conferências e shows com ingresso pago.
            </p>
            <div className="mt-6 flex flex-wrap items-baseline gap-x-1 gap-y-1">
              <span className="text-4xl font-bold tracking-tight text-zinc-900">10%</span>
              <span className="text-sm font-semibold text-zinc-600">
                + R$ 2,00 por ingresso vendido
              </span>
            </div>
            <ul className="mt-8 space-y-3 text-sm text-zinc-600">
              <li className="flex gap-x-3">✅ Pagamentos com cartão (Stripe)</li>
              <li className="flex gap-x-3">✅ Reembolso automatizado</li>
              <li className="flex gap-x-3">✅ Repasse para conta do organizador</li>
              <li className="flex gap-x-3">✅ Mesma base do plano gratuito</li>
            </ul>
            <div className="mt-8">
              <Link href="/auth?mode=register" className="btn-success w-full text-white">
                Começar a vender
              </Link>
            </div>
          </div>
          </ScrollReveal>

          <ScrollReveal className="h-full" delayMs={180}>
          <div className="h-full rounded-2xl border border-emerald-800 bg-gradient-to-b from-emerald-50/80 to-white p-8 shadow-md ring-2 ring-emerald-800">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
              Mais lucro
            </p>
            <h2 className="mt-1 text-xl font-semibold text-emerald-900">
              Aumente seus lucros com uma assinatura
            </h2>
            <p className="mt-2 text-sm text-zinc-600">
              Para quem vende volume e quer taxa menor por ingresso, com mensalidade fixa.
            </p>
            <div className="mt-6 space-y-2">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-2xl font-bold tracking-tight text-zinc-900">R$ 500,00</span>
                <span className="text-sm font-semibold text-zinc-600">/mês</span>
              </div>
              <p className="text-xs font-medium text-emerald-900">Mensalidade</p>
              <div className="flex flex-wrap items-baseline gap-x-1 gap-y-1 border-t border-emerald-200/80 pt-2">
                <span className="text-3xl font-bold tracking-tight text-zinc-900">8%</span>
                <span className="text-sm font-semibold text-zinc-600">
                  + R$ 1,50 por ingresso vendido
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
              <Link href="/auth?mode=register" className="btn-success w-full text-white">
                Quero assinar
              </Link>
            </div>
          </div>
          </ScrollReveal>
        </div>
      </div>

      <div className="mx-auto mt-16 max-w-6xl sm:mt-20">
        <ScrollReveal>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-6 shadow-sm sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
              Exemplo prático
            </p>
            <h2 className="mt-2 text-xl font-semibold text-zinc-900 sm:text-2xl">
              Organizador que vendeu {EX_INGRESSOS.toLocaleString("pt-BR")} ingressos no mês
            </h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              Supondo ingresso médio de {brl(EX_PRECO)} (arrecadação de {brl(exArrecadacao)}), só
              considerando as taxas EventosBR divulgadas acima — sem incluir tarifas do meio de
              pagamento (Stripe) nem impostos.
            </p>
            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Sem assinatura
                </p>
                <p className="mt-1 text-sm text-zinc-600">
                  10% sobre {brl(exArrecadacao)} + R$ 2,00 × {EX_INGRESSOS.toLocaleString("pt-BR")}{" "}
                  ingressos
                </p>
                <p className="mt-3 text-sm text-zinc-600">
                  Total em taxas:{" "}
                  <span className="font-semibold text-zinc-900">{brl(exTaxaSemAssinatura)}</span>
                </p>
                <p className="mt-4 text-lg font-bold text-zinc-900">
                  Estimativa líquida: {brl(exLiquidoSem)}
                </p>
                <p className="mt-1 text-xs text-zinc-500">Arrecadação menos taxas da plataforma.</p>
              </div>
              <div className="rounded-xl border border-emerald-600 bg-white p-5 shadow-md ring-1 ring-emerald-600">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                  Com assinatura
                </p>
                <p className="mt-1 text-sm text-zinc-600">
                  {brl(500)}/mês + 8% sobre {brl(exArrecadacao)} + R$ 1,50 ×{" "}
                  {EX_INGRESSOS.toLocaleString("pt-BR")} ingressos
                </p>
                <p className="mt-3 text-sm text-zinc-600">
                  Total em taxas + mensalidade:{" "}
                  <span className="font-semibold text-zinc-900">{brl(exTaxaComAssinatura)}</span>
                </p>
                <p className="mt-4 text-lg font-bold text-emerald-900">
                  Estimativa líquida: {brl(exLiquidoCom)}
                </p>
                <p className="mt-1 text-xs text-zinc-500">Arrecadação menos taxas e assinatura.</p>
              </div>
            </div>
            <p className="mt-6 rounded-lg bg-emerald-50/90 px-4 py-3 text-sm font-medium text-emerald-950 ring-1 ring-emerald-200/80">
              Neste cenário, com assinatura o organizador fica com cerca de{" "}
              <span className="whitespace-nowrap">{brl(exEconomia)} a mais</span> no mês em relação
              ao plano por uso — antes de impostos e encargos do pagamento.
            </p>
          </div>
        </ScrollReveal>
      </div>

      <div className="mx-auto mt-16 max-w-3xl sm:mt-20">
        <ScrollReveal>
        <div className="rounded-2xl border border-emerald-600 bg-white p-6 shadow-md ring-1 ring-emerald-600 sm:p-8">
          <h2 className="text-lg font-semibold text-emerald-700">Como funcionam as taxas</h2>
          <p className="mt-3 text-justify text-sm leading-6 text-zinc-600">
            No plano de eventos pagos sem assinatura, a taxa percentual e o valor fixo por
            ingresso cobrem processamento via Stripe, infraestrutura e suporte à operação. Na
            assinatura, você paga a mensalidade fixa e passa a usar a taxa reduzida sobre cada
            venda. Você define o preço do ingresso; o comprador paga de forma segura e o repasse
            segue as regras da sua conta conectada na plataforma.
          </p>
          <p className="mt-4 text-justify text-sm leading-6 text-zinc-600">
            Eventos 100% gratuitos para o público permanecem sem taxa de ingresso — use o plano
            gratuito o quanto precisar.
          </p>
        </div>
        </ScrollReveal>
      </div>

      <div className="mx-auto mt-12 max-w-3xl text-center">
        <p className="text-sm text-zinc-600">Pronto para publicar seu primeiro evento?</p>
        <div className="mt-4 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:justify-center">
          <Link href={authHrefParaCriarEvento()} className="btn-success px-6 py-3 text-base shadow-sm">
            Criar evento
          </Link>
          <Link href="/eventos" className="btn-outline px-6 py-3 text-base shadow-sm">
            Ver eventos
          </Link>
        </div>
      </div>
    </div>
  );
}
