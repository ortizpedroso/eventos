import type { Metadata } from "next";
import Link from "next/link";
import { PlanosPricingCards } from "@/components/planos-pricing-cards";
import { PlanosSimuladorComprador } from "@/components/planos-simulador-comprador";
import { PlanosSimuladorLucro } from "@/components/planos-simulador-lucro";
import { hrefCadastroOrganizador } from "@/lib/criar-evento-routes";

export const metadata: Metadata = {
  title: "Planos | EventosBR",
  description:
    "Preços transparentes: eventos gratuitos, taxa por ingresso vendido ou assinatura com taxa reduzida no EventosBR.",
};

const COMPARATIVO: { recurso: string; gratuitos: boolean; pagos: boolean; assinatura: boolean }[] = [
  { recurso: "Página do produtor com logo, cores, capa e favicon", gratuitos: true, pagos: true, assinatura: true },
  { recurso: "Vitrine no seu subdomínio (seunome.eventosbr.app.br)", gratuitos: true, pagos: true, assinatura: true },
  { recurso: "Topo e rodapé da vitrine com as suas cores e o seu texto", gratuitos: true, pagos: true, assinatura: true },
  { recurso: "E-mail do ingresso com o seu logo e o seu nome", gratuitos: true, pagos: true, assinatura: true },
  { recurso: "Check-in com QR Code e lista de participantes", gratuitos: true, pagos: true, assinatura: true },
  { recurso: "PIX, cartão e boleto, com reembolso automatizado", gratuitos: false, pagos: true, assinatura: true },
  { recurso: "Taxa reduzida por ingresso", gratuitos: false, pagos: false, assinatura: true },
  { recurso: "Domínio próprio (ex.: eventos.suamarca.com.br)", gratuitos: false, pagos: false, assinatura: true },
];

function Marca({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="font-semibold text-emerald-700" aria-label="Incluído">
      ✓
    </span>
  ) : (
    <span className="text-zinc-400" aria-label="Não incluído">
      –
    </span>
  );
}

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

        <div className="mx-auto mt-16 max-w-4xl sm:mt-20">
          <h2 className="text-center text-2xl font-bold tracking-tight text-zinc-900">O que cada plano inclui</h2>
          <div className="mt-6 rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <table className="w-full table-fixed text-left text-xs sm:text-sm" data-planos-comparativo>
              <thead className="bg-zinc-50 text-zinc-700">
                <tr>
                  <th className="w-[46%] px-3 py-3 font-semibold sm:w-1/2 sm:px-4">Recurso</th>
                  <th className="px-1 py-3 text-center font-semibold sm:px-4">
                    Gratuitos<span className="hidden sm:inline"> (eventos)</span>
                  </th>
                  <th className="px-1 py-3 text-center font-semibold sm:px-4">
                    Pagos<span className="hidden sm:inline"> (eventos)</span>
                  </th>
                  <th className="px-1 py-3 text-center font-semibold sm:px-4">Assinatura</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-zinc-700">
                {COMPARATIVO.map((linha) => (
                  <tr key={linha.recurso}>
                    <td className="break-words px-3 py-3 sm:px-4">{linha.recurso}</td>
                    <td className="px-1 py-3 text-center sm:px-4"><Marca ok={linha.gratuitos} /></td>
                    <td className="px-1 py-3 text-center sm:px-4"><Marca ok={linha.pagos} /></td>
                    <td className="px-1 py-3 text-center sm:px-4"><Marca ok={linha.assinatura} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
              comprador vê um acréscimo explícito (processamento e antecipação do parcelado); sua taxa e o líquido do
              organizador não mudam.
            </p>
          </div>
        </div>

        <div className="mx-auto mt-12 max-w-3xl text-center">
          <p className="text-sm text-zinc-600">Pronto para publicar seu primeiro evento?</p>
          <div className="mt-4 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:justify-center">
            <Link
              href={hrefCadastroOrganizador}
              prefetch
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
