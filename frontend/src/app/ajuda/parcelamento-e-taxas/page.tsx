import type { Metadata } from "next";
import { AjudaNav } from "@/components/ajuda-nav";
import { AVISO_LEGAL_TAXAS } from "@/lib/taxas-asaas-publicas";

export const metadata: Metadata = { title: "Parcelamento e taxas | Ajuda EventosBR" };

export default function AjudaParcelamentoTaxasPage() {
  return (
    <article className="mx-auto max-w-3xl py-12 px-4 prose prose-zinc">
      <h1>Parcelamento e taxas</h1>
      <AjudaNav current="/ajuda/parcelamento-e-taxas" />
      <p>O organizador pode habilitar parcelamento no cartão (2x a 12x) por evento. O comprador vê o total antes de confirmar.</p>
      <p>Taxas EventosBR e taxas de processamento (PIX, boleto, cartão) são estimadas nos simuladores de /planos e no painel do organizador.</p>
      <p className="text-sm text-zinc-600">{AVISO_LEGAL_TAXAS}</p>
    </article>
  );
}
