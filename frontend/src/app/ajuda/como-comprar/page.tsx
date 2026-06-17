import type { Metadata } from "next";
import { AjudaNav } from "@/components/ajuda-nav";

export const metadata: Metadata = { title: "Como comprar | Ajuda EventosBR" };

export default function AjudaComoComprarPage() {
  return (
    <article className="mx-auto max-w-3xl py-12 px-4 prose prose-zinc">
      <h1>Como comprar ingressos</h1>
      <AjudaNav current="/ajuda/como-comprar" />
      <ol>
        <li>Explore eventos em <strong>/eventos</strong> ou use a busca na navbar.</li>
        <li>Na página do evento, preencha nome, e-mail e CPF do participante.</li>
        <li>Escolha PIX ou cartão (processado via Asaas).</li>
        <li>Após confirmação, o ingresso com QR Code fica em Minha conta → Ingressos.</li>
      </ol>
    </article>
  );
}
