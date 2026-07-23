import type { Metadata } from "next";
import Link from "next/link";
import { PlanosPricingCards } from "@/components/planos-pricing-cards";
import { PlanosSimuladorComprador } from "@/components/planos-simulador-comprador";
import { PlanosSimuladorLucro } from "@/components/planos-simulador-lucro";
import { authHrefRegisterOrganizadorParaCriarEvento } from "@/lib/criar-evento-routes";

export const metadata: Metadata = {
  title: "Planos | EventosBR",
  description:
    "Preços transparentes: eventos gratuitos, taxa por ingresso vendido ou assinatura com taxa reduzida no EventosBR.",
};

export default function PlanosPage() {
  return (
    <div className="pb-16 pt-8 sm:pb-24 sm:pt-12 lg:pb-32 lg:pt-16">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 sm:text-5xl">
          Planos para cada tipo de <span className="text-emerald-700">evento.</span>
        </h1>
        <p className="mt-6 text-lg text-zinc-600 sm:text-xl">
          Sem mensalidade obrigatória para começar. Taxa EventosBR fixa por plano — mesma para PIX, cartão ou
          parcelamento.
        </p>
      </div>

      <div className="textos-justificados">
        <div className="mx-auto mt-16 max-w-6xl sm:mt-20">
          <PlanosPricingCards />
        </div>

        <div className="mx-auto mt-16 max-w-6xl sm:mt-20">
          <PlanosSimuladorLucro />
        </div>

        <div className="mx-auto mt-12 max-w-3xl sm:mt-16">
          <PlanosSimuladorComprador />
        </div>

        <div className="mx-auto mt-16 max-w-3xl sm:mt-20">
          <div className="rounded-2xl border border-emerald-600 bg-white p-6 shadow-md ring-1 ring-emerald-600 sm:p-8">
            <h2 className="text-lg font-semibold text-emerald-700">Como funcionam as taxas</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              No plano de eventos pagos sem assinatura, a taxa percentual e o valor fixo por ingresso são a única taxa
              cobrada — fixa para você e para o organizador, independente do meio de pagamento. No parcelamento, o
              comprador vê um acréscimo explícito; sua taxa e o líquido do organizador não mudam.
            </p>
          </div>
        </div>

        <div className="mx-auto mt-12 max-w-3xl text-center">
          <p className="text-sm text-zinc-600">Pronto para publicar seu primeiro evento?</p>
          <div className="mt-4 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:justify-center">
            <Link
              href={authHrefRegisterOrganizadorParaCriarEvento()}
              prefetch
              scroll={false}
              className="btn-success px-6 py-3 text-base shadow-sm"
            >
              Criar evento
            </Link>
            <Link href="/eventos" className="btn-outline px-6 py-3 text-base shadow-sm">
              Ver eventos
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
