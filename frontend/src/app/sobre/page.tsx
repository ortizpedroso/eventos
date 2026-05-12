import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sobre | EventosBR",
  description:
    "Conheça a EventosBR: plataforma de eventos com ingressos, Stripe e reembolsos para organizadores e participantes.",
};

export default function SobrePage() {
  return (
    <div className="py-16 sm:py-24 lg:py-32">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 sm:text-5xl">
          Sobre a <span className="text-emerald-700">EventosBR.</span>
        </h1>
        <p className="mt-6 text-lg text-zinc-600 sm:text-xl">
          Uma plataforma enxuta para criar eventos, vender ingressos e receber com segurança —
          com foco em quem produz e em quem participa.
        </p>
      </div>

      <div className="mx-auto mt-16 max-w-3xl space-y-6 text-left sm:mt-20">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-semibold text-zinc-900">A nossa proposta</h2>
          <p className="mt-3 text-justify text-sm leading-6 text-zinc-600">
            Queremos reduzir fricção: formulários claros, página pública por evento, pagamentos com
            Stripe e regras de cancelamento que você configura. Menos planilha, mais tempo para o
            conteúdo e para o público.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-semibold text-zinc-900">Para quem é</h2>
          <ul className="mt-4 space-y-3 text-sm text-zinc-600">
            <li className="flex gap-x-3">✅ Organizadores que precisam de inscrições e ingressos pagos</li>
            <li className="flex gap-x-3">✅ Participantes que querem comprar com cartão de forma segura</li>
            <li className="flex gap-x-3">✅ Equipas que valorizam API documentada e stack moderna</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-emerald-600 bg-white p-6 shadow-md ring-1 ring-emerald-600 sm:p-8">
          <h2 className="text-lg font-semibold text-emerald-700">Tecnologia</h2>
          <p className="mt-3 text-justify text-sm leading-6 text-zinc-600">
            O painel web é construído em Next.js e TypeScript; a API em FastAPI, com SQLAlchemy e
            migrações Alembic. Pagamentos e reembolsos passam pelo ecossistema Stripe, incluindo
            suporte a repasse quando o organizador utiliza conta conectada.
          </p>
        </div>
      </div>

      <div className="mx-auto mt-16 max-w-3xl text-center sm:mt-20">
        <p className="text-sm text-zinc-600">Quer experimentar ou ver preços?</p>
        <div className="mt-4 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:justify-center">
          <Link href="/auth?mode=register" className="btn-success px-6 py-3 text-base shadow-sm">
            Criar conta
          </Link>
          <Link href="/funcionalidades" className="btn-outline px-6 py-3 text-base shadow-sm">
            Funcionalidades
          </Link>
        </div>
      </div>
    </div>
  );
}
