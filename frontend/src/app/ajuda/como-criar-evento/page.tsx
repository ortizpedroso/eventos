import type { Metadata } from "next";
import { AjudaArticle } from "@/components/ajuda-article";

export const metadata: Metadata = { title: "Como criar evento | Ajuda EventosBR" };

export default function AjudaCriarEventoPage() {
  return (
    <AjudaArticle title="Como criar um evento" current="/ajuda/como-criar-evento">
      <p>
        Crie uma conta de organizador, configure repasses em Financeiro e use o assistente em
        Organizador → Novo evento.
      </p>
      <p>
        Defina lotes, preços, urgência, parcelamento e listas de interesse/espera conforme sua
        estratégia de venda.
      </p>
    </AjudaArticle>
  );
}
