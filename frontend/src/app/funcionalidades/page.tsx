import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ScrollReveal } from "@/components/scroll-reveal";
import { authHrefRegisterOrganizadorParaCriarEvento } from "@/lib/criar-evento-routes";

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

// Destaques principais (Zigue-zague com Cards Visuais)
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
    visual: (
      <div className="relative flex h-full min-h-[320px] w-full flex-col justify-end overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-900 via-emerald-800 to-zinc-900 p-6 ring-1 ring-emerald-700/40 lg:min-h-[400px]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.12),transparent_45%)]" />
        <div className="absolute right-6 top-6 rounded-xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-100">Página do evento</p>
          <p className="mt-1 text-lg font-bold text-white">Feijoada Comunitária 2026</p>
          <p className="text-sm text-emerald-100">Ingressos a partir de R$ 35</p>
        </div>
        <div className="relative mt-auto flex w-fit items-center gap-2 rounded-full border border-white/20 bg-black/40 px-4 py-2 backdrop-blur-md">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          <span className="text-sm font-medium tracking-wide text-white">Vendas a todo vapor</span>
        </div>
      </div>
    ),
  },
  {
    id: "pagamento",
    titulo: "Segurança de nível global",
    texto: "O dinheiro do seu evento não pode correr riscos. Pagamentos processados com tecnologia de ponta, o padrão ouro do mercado em segurança antifraude.",
    itens: [
      "Aceite cartões, PIX e outras modalidades com proteção total",
      "Menos estornos e proteção robusta contra fraudes",
      "Recebimento direto na sua conta, sem dor de cabeça",
    ],
    visual: (
      <div className="relative flex h-full min-h-[320px] w-full flex-col items-center justify-center overflow-hidden rounded-2xl bg-emerald-50 p-6 shadow-xl ring-1 ring-emerald-200 lg:min-h-[400px]">
        <div className="absolute inset-0 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px] opacity-10" />
        <div className="relative w-full max-w-[280px] rounded-xl bg-white p-5 shadow-lg ring-1 ring-zinc-200/50">
          <div className="flex items-center gap-4 border-b border-zinc-100 pb-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-900">Pagamento aprovado</p>
              <p className="text-xs text-zinc-500">R$ 150,00 via Cartão</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-2 w-full rounded bg-zinc-100" />
            <div className="h-2 w-4/5 rounded bg-zinc-100" />
            <div className="h-2 w-2/3 rounded bg-zinc-100" />
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "checkin",
    titulo: "Check-in sem filas na porta",
    texto: "A experiência do seu público começa na entrada. Controle os acessos de forma ágil com validação inteligente de QR Code.",
    itens: [
      "Ingressos únicos e à prova de falsificação",
      "Status instantâneo: válido, já utilizado ou cancelado",
      "Organize múltiplas portarias simultaneamente",
    ],
    visual: (
      <div className="relative flex h-full min-h-[320px] w-full flex-col justify-end overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900 via-violet-950 to-zinc-900 p-6 ring-1 ring-violet-800/40 lg:min-h-[400px]">
        <div className="absolute left-1/2 top-10 h-40 w-40 -translate-x-1/2 rounded-2xl border-4 border-white/80 bg-white p-3 shadow-2xl">
          <div className="grid h-full grid-cols-4 grid-rows-4 gap-1">
            {Array.from({ length: 16 }).map((_, i) => (
              <div
                key={i}
                className={`rounded-sm ${i % 3 === 0 ? "bg-zinc-900" : "bg-zinc-200"}`}
              />
            ))}
          </div>
        </div>
        <div className="relative mt-auto flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-black/50 p-4 backdrop-blur-md sm:w-auto">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold tracking-wide text-white">Acesso liberado</p>
            <p className="mt-0.5 text-xs font-medium text-zinc-300">TKT-8A9F · Ingresso VIP</p>
          </div>
        </div>
      </div>
    ),
  },
];

// Outros recursos (Grid Menor)
const outrosRecursos = [
  {
    icone: "reembolso",
    titulo: "Reembolsos automatizados",
    texto: "Regras de prazo claras para cancelamento. O sistema sincroniza diretamente com o provedor de pagamentos, reduzindo o trabalho manual do produtor.",
  },
  {
    icone: "conta",
    titulo: "Área do Participante",
    texto: "Seu público tem acesso fácil a um painel onde ficam salvos todos os ingressos, faturas e históricos de eventos.",
  },
  {
    icone: "api",
    titulo: "API documentada",
    texto: "Precisa de uma integração específica? Nosso backend em FastAPI possui documentação interativa completa (OpenAPI).",
  },
] as const;

export default function FuncionalidadesPage() {
  return (
    <div className="overflow-hidden pb-16 pt-8 sm:pb-24 sm:pt-12 lg:pb-32 lg:pt-16">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 sm:text-5xl">
          Tudo o que você precisa para <span className="text-emerald-700">fazer acontecer.</span>
        </h1>
        <p className="mt-6 text-lg text-zinc-600 sm:text-xl">
          Uma estrutura completa de vendas, pagamentos e check-in. Esqueça as planilhas e 
          foque no que realmente importa: a experiência do seu público.
        </p>
      </div>

      {/* Seção Zigue-Zague */}
      <div className="mx-auto mt-16 max-w-7xl px-4 sm:mt-24 sm:px-6 lg:px-8">
        <div className="space-y-24">
          {destaques.map((item, index) => {
            const isReversed = index % 2 !== 0;
            return (
              <ScrollReveal key={item.id} delayMs={100}>
                <div className={`flex flex-col gap-12 lg:items-center ${isReversed ? 'lg:flex-row-reverse' : 'lg:flex-row'}`}>
                  
                  {/* Texto */}
                  <div className="flex-1 lg:max-w-xl">
                    <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
                      {item.titulo}
                    </h2>
                    <p className="mt-4 text-lg text-zinc-600 text-justify">
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
                    {item.visual}
                  </div>
                </div>
              </ScrollReveal>
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
          {outrosRecursos.map((b, i) => (
            <ScrollReveal key={b.titulo} className="h-full" delayMs={i * 75}>
            <div
              className="h-full rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8"
            >
              <div className="flex items-start gap-3">
                {icones[b.icone]}
                <h2 className="text-lg font-semibold leading-tight text-zinc-900">{b.titulo}</h2>
              </div>
              <p className="mt-4 text-justify text-sm leading-6 text-zinc-600">{b.texto}</p>
            </div>
            </ScrollReveal>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-16 max-w-3xl sm:mt-20">
        <ScrollReveal>
          <div className="rounded-2xl border border-emerald-600 bg-white p-6 shadow-md ring-1 ring-emerald-600 sm:p-8">
            <div className="flex items-start gap-3">
              {icones.resumo}
              <h2 className="text-lg font-semibold leading-tight text-emerald-700">Resumo</h2>
            </div>
            <p className="mt-3 text-justify text-sm leading-6 text-zinc-600">
              O EventosBR concentra criação de eventos, venda de ingressos, cobrança automatizada 
              e tratamento de cancelamentos em um fluxo único — ideal para quem quer menos planilha 
              e mais tempo focando em produzir a experiência ao vivo.
            </p>
          </div>
        </ScrollReveal>
      </div>

      <div className="mx-auto mt-12 max-w-3xl text-center">
        <p className="text-sm text-zinc-600">Quer ver valores ou criar sua conta?</p>
        <div className="mt-4 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:justify-center">
          <Link href="/planos" className="btn-outline px-6 py-3 text-base shadow-sm">
            Ver planos
          </Link>
          <Link href={authHrefRegisterOrganizadorParaCriarEvento()} className="btn-success px-6 py-3 text-base shadow-sm">
            Criar conta
          </Link>
        </div>
      </div>
    </div>
  );
}
