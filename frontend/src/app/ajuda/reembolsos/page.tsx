import type { Metadata } from "next";
import { AjudaArticle } from "@/components/ajuda-article";

export const metadata: Metadata = { title: "Reembolsos | Ajuda EventosBR" };

export default function AjudaReembolsosPage() {
  return (
    <AjudaArticle title="Reembolsos" current="/ajuda/reembolsos">
      <p>
        Ingressos pagos podem ser cancelados em <strong>Minha conta → Pagamentos</strong> dentro do
        prazo legal (até 10 dias), desde que o ingresso não tenha sido usado na entrada.
      </p>
      <p>O reembolso é processado automaticamente pela plataforma de pagamentos.</p>
    </AjudaArticle>
  );
}
