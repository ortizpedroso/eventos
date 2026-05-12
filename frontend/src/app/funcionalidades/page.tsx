import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ScrollReveal } from "@/components/scroll-reveal";
import { authHrefRegisterOrganizadorParaCriarEvento } from "@/lib/criar-evento-routes";

export const metadata: Metadata = {
  title: "Funcionalidades | EventosBR",
  description:
    "O que o EventosBR oferece para organizadores e participantes: eventos, ingressos, pagamentos Stripe e reembolsos.",
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

const blocos = [
  {
    icone: "calendario",
    titulo: "Eventos e página pública",
    texto:
      "Crie eventos com nome, data, local e descrição. Cada evento ganha uma página para divulgação e venda de ingressos.",
    itens: [
      "Cadastro e edição pelo organizador",
      "URL amigável para compartilhar",
      "Listagem para explorar o que está rolando",
    ],
  },
  {
    icone: "ingresso",
    titulo: "Ingressos",
    texto:
      "Venda ou distribua ingressos com registro claro de quem comprou e em qual status está cada pedido.",
    itens: [
      "Ingressos gratuitos ou pagos",
      "Acompanhamento de status (pendente, pago, cancelado)",
      "Fluxo preparado para check-in na entrada",
    ],
  },
  {
    icone: "pagamento",
    titulo: "Pagamentos com Stripe",
    texto:
      "Cartão e métodos habilitados pelo Stripe, com ambiente seguro e confirmação automática quando o pagamento é concluído.",
    itens: [
      "Payment Intents integrados à compra",
      "Repasse para conta do organizador (Connect), quando configurado",
      "Webhooks para manter status sincronizado",
    ],
  },
  {
    icone: "reembolso",
    titulo: "Reembolsos e cancelamentos",
    texto:
      "Regras de prazo para o participante solicitar cancelamento, com processamento de reembolso alinhado ao Stripe.",
    itens: [
      "Política com data limite por ingresso",
      "Registro de cancelamento e valor reembolsado",
      "Menos trabalho manual para o produtor",
    ],
  },
  {
    icone: "conta",
    titulo: "Conta e acesso",
    texto:
      "Perfis para quem organiza e para quem participa, com sessão por token e área logada para ingressos e pagamentos.",
    itens: [
      "Cadastro e login seguros",
      "Cliente e organizador no mesmo produto",
      "Painel para ver ingressos e histórico de pagamentos",
    ],
  },
  {
    icone: "api",
    titulo: "API documentada",
    texto:
      "Backend em FastAPI com documentação interativa para quem quiser integrar ou evoluir o sistema.",
    itens: ["OpenAPI / Swagger na API", "Endpoints REST consistentes", "Pronto para evoluir com o seu time"],
  },
] as const;

export default function FuncionalidadesPage() {
  return (
    <div className="py-16 sm:py-24 lg:py-32">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 sm:text-5xl">
          Tudo o que você precisa para <span className="text-emerald-700">viver o evento.</span>
        </h1>
        <p className="mt-6 text-lg text-zinc-600 sm:text-xl">
          Da divulgação à venda, do pagamento ao reembolso — fluxos pensados para organizadores e
          participantes, sem excesso de telas.
        </p>
      </div>

      <div className="mx-auto mt-16 max-w-5xl sm:mt-20">
        <div className="grid grid-cols-1 gap-6 text-left sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {blocos.map((b, i) => (
            <ScrollReveal key={b.titulo} className="h-full" delayMs={i * 75}>
            <div
              className="h-full rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8"
            >
              <div className="flex items-start gap-3">
                {icones[b.icone]}
                <h2 className="text-lg font-semibold leading-tight text-zinc-900">{b.titulo}</h2>
              </div>
              <p className="mt-3 text-justify text-sm leading-6 text-zinc-600">{b.texto}</p>
              <ul className="mt-6 space-y-3 text-sm text-zinc-600">
                {b.itens.map((item) => (
                  <li key={item} className="flex gap-x-3">
                    <span className="shrink-0" aria-hidden>
                      ✅
                    </span>
                    <span className="min-w-0 flex-1 text-justify">{item}</span>
                  </li>
                ))}
              </ul>
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
              O EventosBR concentra criação de eventos, venda de ingressos, cobrança via Stripe e
              tratamento de cancelamentos em um fluxo único — ideal para quem quer menos planilha e
              mais tempo produzindo experiência ao vivo.
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
