import type { Metadata } from "next";
import Link from "next/link";

import { CriarEventoLink } from "@/components/criar-evento-link";
import { MarketingScreenshot } from "@/components/marketing-screenshot";

export const metadata: Metadata = {
  title: "Para produtores de eventos | EventosBR",
  description:
    "Venda ingressos com a sua marca, receba o valor líquido combinado sem surpresas, e tenha check-in, lotes e reembolso automático numa plataforma só.",
};

const iconClass = "h-6 w-6 shrink-0 text-emerald-700";

function Icone({ path }: { path: string }) {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  );
}

const diferenciais: { titulo: string; texto: string; icone: string }[] = [
  {
    titulo: "Taxa clara, sem letra miúda",
    texto:
      "O valor que você vê no simulador é o valor que cai na sua conta. Sem taxa escondida, sem \"a combinar\", sem depender de time comercial pra saber quanto você recebe.",
    icone: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  },
  {
    titulo: "Sua marca, não a nossa",
    texto:
      "Personalize logo, cores e subdomínio da sua página de vendas. Quem compra vê a sua identidade — a EventosBR fica nos bastidores, cuidando da parte chata (pagamento, segurança, infraestrutura).",
    icone: "M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42",
  },
  {
    titulo: "Repasse sem enrolação",
    texto:
      "Acompanhe cada venda no seu extrato dentro da plataforma, em tempo real. Antecipação automática disponível pra quem quer receber antes do prazo padrão, sem burocracia.",
    icone: "M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0z",
  },
  {
    titulo: "Operação completa, não só a venda",
    texto:
      "Lotes com data de troca automática, cupons de desconto, lista de espera, check-in por QR Code com múltiplas portarias simultâneas e reembolso automático conforme sua política.",
    icone: "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
];

const passos = [
  {
    numero: "1",
    titulo: "Crie sua conta",
    texto: "Cadastro gratuito, sem cartão de crédito. Leva menos de 2 minutos.",
  },
  {
    numero: "2",
    titulo: "Publique seu evento",
    texto: "Nome, data, local, lotes e preços. Personalize logo e cores se quiser.",
  },
  {
    numero: "3",
    titulo: "Venda e acompanhe",
    texto: "Divulgue o link, acompanhe vendas em tempo real e receba conforme combinado.",
  },
];

export default function ParaProdutoresPage() {
  return (
    <div className="overflow-hidden pb-16 pt-8 sm:pb-24 sm:pt-12 lg:pb-32 lg:pt-16">
      {/* Hero */}
      <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8">
        <div>
          <p className="text-center text-sm font-semibold uppercase tracking-wide text-emerald-700">
            Para produtores
          </p>
          <h1 className="mt-3 text-center text-4xl font-extrabold tracking-tight text-zinc-900 sm:text-5xl">
            Venda com a sua marca.
            <br />
            Receba o valor combinado.
            <br />
            <span className="text-emerald-700">Taxa clara, sem surpresa.</span>
          </h1>
          <p className="mt-6 text-justify text-lg leading-relaxed text-zinc-600">
            Não somos mais uma vitrine genérica de eventos. Somos a plataforma completa pra quem quer vender
            ingressos com identidade própria, saber exatamente quanto vai receber, e não perder tempo
            apagando incêndio de check-in ou reembolso na hora do evento.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <CriarEventoLink className="btn-success px-6 py-3 text-base shadow-sm">
              Criar minha conta grátis
            </CriarEventoLink>
            <Link href="/planos" className="btn-outline px-6 py-3 text-base shadow-sm">
              Ver taxas e simular
            </Link>
          </div>
        </div>
        <MarketingScreenshot
          src="/marketing/organizador.webp"
          alt="Painel do organizador EventosBR mostrando vendas e configurações do evento"
          priority
        />
      </div>

      {/* Diferenciais */}
      <div className="mx-auto mt-20 max-w-7xl px-4 sm:mt-28 sm:px-6 lg:px-8">
        <h2 className="text-center text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
          O que muda pra você, na prática
        </h2>
        <div className="mt-12 grid gap-8 sm:grid-cols-2">
          {diferenciais.map((d) => (
            <div key={d.titulo} className="reveal rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
              <Icone path={d.icone} />
              <h3 className="mt-4 text-lg font-semibold text-zinc-900">{d.titulo}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600 text-justify">{d.texto}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Marca própria — destaque específico do whitelabel */}
      <div className="mx-auto mt-20 max-w-7xl px-4 sm:mt-28 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8 sm:p-12">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Whitelabel</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
                A página de vendas veste a sua marca
              </h2>
              <p className="mt-4 text-zinc-700 text-justify">
                Configure logo, favicon, cores e um subdomínio próprio direto no seu perfil de organizador.
                Quem compra o ingresso vê a identidade do seu evento do início ao fim — inclusive nos
                e-mails de confirmação.
              </p>
              <CriarEventoLink className="mt-6 inline-flex items-center font-medium text-emerald-700 underline-offset-2 hover:underline">
                Criar conta e personalizar →
              </CriarEventoLink>
            </div>
            <ul className="space-y-3 text-sm text-zinc-700">
              <li className="flex items-start gap-2">
                <Icone path="M4.5 12.75l6 6 9-13.5" />
                <span>Logo e favicon próprios em toda a experiência de compra</span>
              </li>
              <li className="flex items-start gap-2">
                <Icone path="M4.5 12.75l6 6 9-13.5" />
                <span>Cor de marca aplicada nos botões e destaques da página</span>
              </li>
              <li className="flex items-start gap-2">
                <Icone path="M4.5 12.75l6 6 9-13.5" />
                <span>Subdomínio próprio (ex.: seuevento.eventosbr.app.br)</span>
              </li>
              <li className="flex items-start gap-2">
                <Icone path="M4.5 12.75l6 6 9-13.5" />
                <span>Perfil público reunindo todos os seus eventos</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Como funciona */}
      <div className="mx-auto mt-20 max-w-5xl px-4 sm:mt-28 sm:px-6 lg:px-8">
        <h2 className="text-center text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
          Do zero ao primeiro ingresso vendido
        </h2>
        <div className="mt-12 grid gap-8 sm:grid-cols-3">
          {passos.map((p) => (
            <div key={p.numero} className="reveal text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-lg font-bold text-emerald-700">
                {p.numero}
              </div>
              <h3 className="mt-4 text-base font-semibold text-zinc-900">{p.titulo}</h3>
              <p className="mt-2 text-sm text-zinc-600 text-justify">{p.texto}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA final */}
      <div className="mx-auto mt-20 max-w-3xl px-4 text-center sm:mt-28 sm:px-6">
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
          Pronto pra vender o seu jeito?
        </h2>
        <p className="mt-4 text-zinc-600">
          Sem mensalidade fixa, sem cartão de crédito pra testar. Você só paga quando vende.
        </p>
        <div className="mt-6 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <CriarEventoLink className="btn-success px-6 py-3 text-base shadow-sm">
            Criar minha conta grátis
          </CriarEventoLink>
          <Link href="/planos" className="btn-outline px-6 py-3 text-base shadow-sm">
            Ver taxas e simular
          </Link>
        </div>
        <p className="mt-6 text-sm text-zinc-500">
          Alguma dúvida antes de começar?{" "}
          <Link href="/contato" className="font-medium text-emerald-700 underline-offset-2 hover:underline">
            Fale conosco
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
