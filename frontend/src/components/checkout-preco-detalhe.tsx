"use client";

import Link from "next/link";

import { AVISO_LEGAL_TAXAS, INGRESSO_MINIMO_PAGO_REAIS } from "@/lib/taxas-asaas-publicas";
import { formatBrl } from "@/lib/tarifas-plataforma";

type Props = {
  precoIngresso: number;
  destaque?: boolean;
  className?: string;
};

/** Bloco all-in para o comprador: preço do ingresso + nota de processamento (sem taxa do organizador). */
export function CheckoutPrecoDetalhe({ precoIngresso, destaque = false, className = "" }: Props) {
  if (!Number.isFinite(precoIngresso) || precoIngresso < INGRESSO_MINIMO_PAGO_REAIS) {
    return null;
  }

  return (
    <div
      className={`rounded-md border border-emerald-200 bg-emerald-50/80 text-sm ${destaque ? "px-3 py-3" : "px-3 py-2.5"} ${className}`}
    >
      {destaque ? (
        <>
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-800">Preço do ingresso</p>
          <p className="mt-1 text-2xl font-bold text-emerald-900">{formatBrl(precoIngresso)}</p>
        </>
      ) : (
        <p className="text-sm font-semibold text-emerald-900">Ingresso: {formatBrl(precoIngresso)}</p>
      )}
      <p className="mt-2 text-xs text-emerald-950/90">
        O valor final no checkout pode incluir acréscimo de parcelamento, quando disponível. Taxas de processamento
        estão incluídas conforme o método de pagamento escolhido.
      </p>
      <p className="mt-2 text-[11px] text-emerald-800/70">{AVISO_LEGAL_TAXAS}</p>
      <p className="mt-2 text-[11px] text-emerald-800/70">
        <Link href="/ajuda/parcelamento-e-taxas" className="underline underline-offset-2 hover:text-emerald-900">
          Saiba mais sobre parcelamento e taxas
        </Link>
      </p>
    </div>
  );
}
