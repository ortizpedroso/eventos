import type { Metadata } from "next";
import { AjudaNav } from "@/components/ajuda-nav";

export const metadata: Metadata = { title: "Como criar evento | Ajuda EventosBR" };

export default function AjudaCriarEventoPage() {
  return (
    <article className="mx-auto max-w-3xl py-12 px-4 prose prose-zinc">
      <h1>Como criar um evento</h1>
      <AjudaNav current="/ajuda/como-criar-evento" />
      <p>Crie uma conta de organizador, configure repasses em Financeiro e use o assistente em Organizador → Novo evento.</p>
      <p>Defina lotes, preços, urgência, parcelamento e listas de interesse/espera conforme sua estratégia de venda.</p>
    </article>
  );
}
