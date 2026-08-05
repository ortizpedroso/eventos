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
  {
    href: "/ajuda/pagamentos-e-seguranca",
    titulo: "Pagamentos e segurança",
    descricao: "Quem processa o pagamento, o que a EventosBR guarda e o que esperar em picos de venda.",
  },
] as const;

export default function AjudaPage() {
  return (
    <article className="pb-16 pt-8 sm:pb-24 sm:pt-12">
      <div className="content-prose mx-auto max-w-3xl px-4 sm:px-6">
        <h1>Central de ajuda</h1>
        <AjudaNav current="/ajuda" />
        <p>
          Encontre respostas rápidas sobre compra de ingressos, criação de eventos, reembolsos,
          taxas e como funcionam pagamentos e segurança na plataforma.
        </p>
        <ul className="mt-8 list-none space-y-3 !ml-0">
          {topicos.map((t) => (
            <li key={t.href} className="!mt-0 !text-left">
              <Link
                href={t.href}
                className="ajuda-nav-link flex flex-col gap-1 rounded-full border border-zinc-200 bg-zinc-100 px-4 py-3 text-sm font-normal text-zinc-700 no-underline hover:bg-zinc-200 sm:flex-row sm:items-baseline sm:gap-3"
              >
                <span className="shrink-0">{t.titulo}</span>
                <span className="text-sm font-normal text-zinc-500">{t.descricao}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
