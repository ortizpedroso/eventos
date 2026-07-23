import type { Metadata } from "next";
import { AjudaArticle } from "@/components/ajuda-article";

export const metadata: Metadata = { title: "Como comprar | Ajuda EventosBR" };

export default function AjudaComoComprarPage() {
  return (
    <AjudaArticle title="Como comprar ingressos" current="/ajuda/como-comprar">
      <ol>
        <li>
          Explore eventos em <strong>/eventos</strong> ou use a busca na navbar.
        </li>
        <li>Na página do evento, preencha nome, e-mail e CPF do participante.</li>
        <li>Escolha PIX ou cartão (pagamento seguro online).</li>
        <li>Após confirmação, o ingresso com QR Code fica em Minha conta → Ingressos.</li>
      </ol>
    </AjudaArticle>
  );
}
