import type { Metadata } from "next";
import { AjudaNav } from "@/components/ajuda-nav";
import { AVISO_LEGAL_TAXAS, INGRESSO_MINIMO_PAGO_REAIS } from "@/lib/taxas-asaas-publicas";
import { TARIFA_PADRAO, rotuloTaxa } from "@/lib/tarifas-plataforma";

export const metadata: Metadata = { title: "Parcelamento e taxas | Ajuda EventosBR" };

export default function AjudaParcelamentoTaxasPage() {
  return (
    <article className="mx-auto max-w-3xl py-12 px-4 prose prose-zinc">
      <h1>Parcelamento e taxas</h1>
      <AjudaNav current="/ajuda/parcelamento-e-taxas" />
      <p>
        A taxa EventosBR é <strong>fixa por ingresso</strong> ({rotuloTaxa(TARIFA_PADRAO)} no plano padrão) — igual
        para PIX, cartão à vista ou parcelado. O processador de pagamento fica embutido; você não vê taxas separadas
        de processamento no checkout.
      </p>
      <h2>Parcelamento</h2>
      <p>
        O organizador pode habilitar parcelamento no cartão (2x a 12x) por evento. À vista, PIX e boleto não incluem
        acréscimo. No parcelado, o organizador escolhe <strong>repassar o acréscimo ao comprador</strong> (padrão) ou{" "}
        <strong>absorver</strong> (recebe menos no repasse).
      </p>
      <p>
        Ingressos pagos têm valor mínimo de R$ {INGRESSO_MINIMO_PAGO_REAIS.toFixed(2).replace(".", ",")}.
      </p>
      <p>
        Repasses são automáticos no momento da venda (split). O extrato em Financeiro mostra o líquido por ingresso.
      </p>
      <p className="text-sm text-zinc-600">{AVISO_LEGAL_TAXAS}</p>
    </article>
  );
}
