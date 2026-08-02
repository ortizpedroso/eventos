import Link from "next/link";

import { CriarEventoLink } from "@/components/criar-evento-link";

const features = [
  {
    titulo: "Venda de ingressos",
    descricao: "Página pública, lotes e checkout PIX ou cartão.",
  },
  {
    titulo: "Check-in QR Code",
    descricao: "Entrada rápida na portaria, sem fila de planilha.",
  },
  {
    titulo: "Financeiro",
    descricao: "Extrato, saldo e solicitação de saque na plataforma.",
  },
  {
    titulo: "Repasse automático",
    descricao: "Split na venda — você recebe o líquido combinado.",
  },
  {
    titulo: "Whitelabel",
    descricao: "Sua marca na página do evento e nos e-mails.",
  },
  {
    titulo: "Relatórios",
    descricao: "Vendas, conversão e lista de participantes.",
  },
] as const;

export function HomeProdutorFeatures() {
  return (
    <section
      className="reveal mx-auto mt-16 max-w-6xl sm:mt-20"
      aria-labelledby="home-produtor-features-titulo"
    >
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-emerald-800">
          Para organizadores
        </p>
        <h2
          id="home-produtor-features-titulo"
          className="mt-3 text-2xl font-extrabold tracking-tight text-zinc-900 sm:text-3xl"
        >
          Crie, venda e gerencie sem planilhas
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-base text-zinc-600">
          Tudo que você precisa para publicar o evento, receber pagamentos e operar o dia — em um só
          painel.
        </p>
      </div>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <div
            key={f.titulo}
            className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
          >
            <h3 className="font-semibold text-zinc-900">{f.titulo}</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">{f.descricao}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <CriarEventoLink className="btn-success px-6 py-3 text-base shadow-sm">
          Começar meu evento grátis
        </CriarEventoLink>
        <Link href="/produtores" className="btn-outline px-6 py-3 text-base shadow-sm">
          Ver página para produtores
        </Link>
      </div>
    </section>
  );
}
