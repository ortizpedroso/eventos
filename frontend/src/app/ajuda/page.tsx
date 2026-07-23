import type { Metadata } from "next";
import Link from "next/link";
import { AjudaNav } from "@/components/ajuda-nav";

export const metadata: Metadata = {
  title: "Central de ajuda | EventosBR",
};

const topicos = [
  {
    href: "/ajuda/como-comprar",
    titulo: "Como comprar ingressos",
    descricao: "Passo a passo da busca até o QR Code em Minha conta.",
  },
  {
    href: "/ajuda/como-criar-evento",
    titulo: "Como criar um evento",
    descricao: "Conta de organizador, lotes, preços e publicação.",
  },
  {
    href: "/ajuda/reembolsos",
    titulo: "Reembolsos e cancelamentos",
    descricao: "Prazos, elegibilidade e processamento automático.",
  },
  {
    href: "/ajuda/parcelamento-e-taxas",
    titulo: "Parcelamento e taxas",
    descricao: "Taxa EventosBR fixa, parcelamento e repasse ao organizador.",
  },
] as const;

export default function AjudaPage() {
  return (
    <article className="pb-16 pt-8 sm:pb-24 sm:pt-12">
      <div className="content-prose mx-auto max-w-3xl px-4 sm:px-6">
        <h1>Central de ajuda</h1>
        <AjudaNav current="/ajuda" />
        <p>
          Encontre respostas rápidas sobre compra de ingressos, criação de eventos, reembolsos e
          taxas da plataforma.
        </p>
        <ul className="mt-8 space-y-4">
          {topicos.map((t) => (
            <li key={t.href} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <Link href={t.href} className="text-base font-semibold text-emerald-900 no-underline hover:underline">
                {t.titulo}
              </Link>
              <p className="mt-1 text-sm">{t.descricao}</p>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
