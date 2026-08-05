import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { CriarEventoLink } from "@/components/criar-evento-link";
import { MarketingScreenshot } from "@/components/marketing-screenshot";

export const metadata: Metadata = {
  title: "Funcionalidades | EventosBR",
  description:
    "O que o EventosBR oferece para organizadores e participantes: eventos, ingressos, pagamentos seguros e reembolsos.",
};

const iconClass = "h-6 w-6 shrink-0 text-emerald-700";

const icones: Record<string, ReactNode> = {
  calendario: (
    <svg
      className={iconClass}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5a2.25 2.25 0 002.25-2.25m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5a2.25 2.25 0 012.25 2.25v7.5"
      />
    </svg>
  ),
  ingresso: (
    <svg
      className={iconClass}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.5 6v11.25A2.25 2.25 0 0018.75 19.5h-13.5a2.25 2.25 0 00-2.25-2.25V6m16.5 0v-.75A2.25 2.25 0 0018.75 3h-13.5A2.25 2.25 0 003 5.25V6m16.5 0H3M9 10.5h6"
      />
    </svg>
  ),
  pagamento: (
    <svg
      className={iconClass}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"
      />
    </svg>
  ),
  reembolso: (
    <svg
      className={iconClass}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"
      />
    </svg>
  ),
  conta: (
    <svg
      className={iconClass}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
      />
    </svg>
  ),
  api: (
    <svg
      className={iconClass}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"
      />
    </svg>
  ),
  resumo: (
    <svg
      className={iconClass}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
      />
    </svg>
  ),
};

const destaques = [
  {
    id: "venda",
    titulo: "Da ideia à venda em minutos",
    texto: "Seja uma feijoada comunitária, um torneio de beach tennis ou um show internacional: crie sua página de evento, defina lotes e preços, e comece a vender no mesmo dia.",
    itens: [
      "Página exclusiva e otimizada para converter",
      "URL amigável para compartilhar no Instagram e WhatsApp",
      "Acompanhamento de vendas em tempo real",
    ],
    imageSrc: "/marketing/organizador.webp",
    imageAlt:
      "Captura de tela do painel Meus eventos do organizador na EventosBR, com lista de eventos e status de publicação",
    ringClass: "ring-emerald-700/40",
  },
  {
    id: "pagamento",
    titulo: "Pagamentos com processador certificado",
    texto: "PIX e cartão passam por um processador de pagamentos certificado. A EventosBR organiza a venda e o ingresso — não armazena o número completo do cartão nos nossos servidores.",
    itens: [
      "Aceite PIX, cartão e outras modalidades disponíveis no checkout",
      "Antifraude e cobrança ficam a cargo do processador de pagamentos",
      "Repasse líquido na conta de recebimento do organizador",
    ],
    imageSrc: "/marketing/checkout.webp",
    imageAlt:
      "Captura de tela do checkout EventosBR mostrando pagamento PIX com QR Code e código copia e cola",
    ringClass: "ring-emerald-200",
  },
  {
    id: "checkin",
    titulo: "Check-in sem filas na porta",
    texto: "A experiência do seu público começa na entrada. Controle os acessos de forma ágil com validação inteligente de QR Code.",
    itens: [
      "Ingressos com QR Code único por compra",
      "Status instantâneo: válido, já utilizado ou cancelado",
      "Organize múltiplas portarias simultaneamente",
    ],
    imageSrc: "/marketing/portaria.webp",
    imageAlt:
      "Captura de tela da validação de ingressos na portaria EventosBR com leitura de QR Code",
    ringClass: "ring-violet-800/40",
  },
];

// Outros recursos (Grid Menor)
const outrosRecursos = [
  {
    icone: "reembolso",
    titulo: "Reembolsos automatizados",
    texto: "Regras de prazo claras para cancelamento. O sistema sincroniza com o provedor de pagamentos, reduzindo trabalho manual.",
  },
  {
    icone: "conta",
    titulo: "Área do participante",
    texto: "Ingressos, histórico e repasse oficial de ingresso — tudo em Minha conta, no celular.",
  },
  {
    icone: "pagamento",
    titulo: "Financeiro e repasse",
    texto: "Extrato, saldo e saque na plataforma. O líquido da venda cai na sua conta de recebimento com split automático.",
  },
  {
    icone: "resumo",
    titulo: "Relatórios completos",
    texto: "Vendas por lote, taxa de conversão e exportação de participantes para operar o evento com dados reais.",
  },
  {
    icone: "ingresso",
    titulo: "Página com sua marca",
    texto: "Whitelabel: logo, cores e domínio personalizado na página pública do evento e nos e-mails.",
  },
  {
    icone: "api",
    titulo: "Integrações quando precisar",
    texto: "Conecte ferramentas externas ou automações — documentação disponível para equipes técnicas.",
  },
] as const;

export default function FuncionalidadesPage() {
  return (
    <div className="overflow-hidden pb-16 pt-8 sm:pb-24 sm:pt-12 lg:pb-32 lg:pt-16 textos-justificados">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 sm:text-5xl">
          Tudo o que você precisa para <span className="text-emerald-700">fazer acontecer.</span>
        </h1>
        <p className="mt-6 text-lg text-zinc-600 sm:text-xl">
          Uma estrutura completa de vendas, pagamentos e check-in. Esqueça as planilhas e foque no
          que importa: vender ingressos e entregar uma boa experiência.
        </p>
      </div>

      {/* Âncoras para links da home (REQ-03) */}
      <div className="mx-auto mt-16 max-w-7xl px-4 sm:mt-20 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-2">
          <section id="compra-rapida" className="scroll-mt-24 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-xl font-bold text-zinc-900">Compra rápida</h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600">
              Finalize em minutos com e-mail e CPF — sem cadastro completo obrigatório. Ideal para quem
              quer garantir o ingresso no celular.
            </p>
          </section>
          <section id="repasse" className="scroll-mt-24 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-xl font-bold text-zinc-900">Repasse oficial de ingresso</h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600">
              Transfira seu ingresso para outra pessoa de forma segura, com rastreio em Minha conta e
              validação na portaria.
            </p>
          </section>
        </div>
      </div>

      {/* Seção Zigue-Zague */}
      <div className="mx-auto mt-16 max-w-7xl px-4 sm:mt-24 sm:px-6 lg:px-8">
        <div className="space-y-24">
          {destaques.map((item, index) => {
            const isReversed = index % 2 !== 0;
            return (
              <div key={item.id} className={`flex flex-col gap-12 lg:items-center ${isReversed ? 'lg:flex-row-reverse' : 'lg:flex-row'}`}>
                  
                  {/* Texto */}
                  <div className="flex-1 lg:max-w-xl">
                    <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
                      {item.titulo}
                    </h2>
                    <p className="mt-4 text-lg text-zinc-600">
                      {item.texto}
                    </p>
                    <ul className="mt-8 space-y-4 text-zinc-600">
                      {item.itens.map((li) => (
                        <li key={li} className="flex gap-x-3">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          </span>
                          <span className="leading-6">{li}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Visual UI Mock */}
                  <div className="flex-1 w-full lg:max-w-none">
                    <MarketingScreenshot
                      src={item.imageSrc}
                      alt={item.imageAlt}
                      ringClass={item.ringClass}
                    />
                  </div>
                </div>
            );
          })}
        </div>
      </div>

      {/* Grid Menor de Outros Recursos */}
      <div className="mx-auto mt-24 max-w-7xl px-4 sm:mt-32 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900">E não para por aí</h2>
        </div>
        <div className="grid grid-cols-1 gap-6 text-left sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {outrosRecursos.map((b) => (
            <div key={b.titulo} className="reveal h-full">
            <div
              className="h-full rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8"
            >
              <div className="flex items-start gap-3">
                {icones[b.icone]}
                <h2 className="text-lg font-semibold leading-tight text-zinc-900">{b.titulo}</h2>
              </div>
              <p className="mt-4 text-sm leading-6 text-zinc-600">{b.texto}</p>
            </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-16 max-w-3xl sm:mt-20">
          <div className="rounded-2xl border border-emerald-600 bg-white p-6 shadow-md ring-1 ring-emerald-600 sm:p-8">
            <div className="flex items-start gap-3">
              {icones.resumo}
              <h2 className="text-lg font-semibold leading-tight text-emerald-700">Resumo</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              O EventosBR concentra criação de eventos, venda de ingressos, cobrança automatizada 
              e tratamento de cancelamentos em um fluxo único — ideal para quem quer menos planilha 
              e mais tempo focando em produzir a experiência ao vivo.
            </p>
          </div>
      </div>

      <div className="mx-auto mt-12 max-w-3xl text-center">
        <p className="text-sm text-zinc-600">Quer ver valores ou criar sua conta?</p>
        <div className="mt-4 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:justify-center">
          <Link href="/planos" className="btn-outline px-6 py-3 text-base shadow-sm">
            Ver planos
          </Link>
          <CriarEventoLink className="btn-success px-6 py-3 text-base shadow-sm">
            Criar conta
          </CriarEventoLink>
        </div>
      </div>
    </div>
  );
}
