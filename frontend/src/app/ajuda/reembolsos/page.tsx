import type { Metadata } from "next";
import { AjudaNav } from "@/components/ajuda-nav";

export const metadata: Metadata = { title: "Reembolsos | Ajuda EventosBR" };

export default function AjudaReembolsosPage() {
  return (
    <article className="mx-auto max-w-3xl py-12 px-4 prose prose-zinc">
      <h1>Reembolsos</h1>
      <AjudaNav current="/ajuda/reembolsos" />
      <p>Ingressos pagos podem ser cancelados em <strong>Minha conta → Pagamentos</strong> dentro do prazo legal (até 10 dias), desde que o ingresso não tenha sido usado na entrada.</p>
      <p>O reembolso é processado automaticamente pelo gateway de pagamento.</p>
    </article>
  );
}
