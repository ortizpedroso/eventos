"use client";

import Link from "next/link";

import {
  TARIFA_PADRAO,
  detalharTaxaIngresso,
  formatBrl,
  rotuloTaxa,
} from "@/lib/tarifas-plataforma";

type Props = {
  precoIngresso: number;
  destaque?: boolean;
  className?: string;
};

export function CheckoutPrecoDetalhe({ precoIngresso, destaque = false, className = "" }: Props) {
  if (!Number.isFinite(precoIngresso) || precoIngresso < 0.5) {
    return null;
  }

  const d = detalharTaxaIngresso(precoIngresso, TARIFA_PADRAO);
  if (!d) return null;

  return (
    <div
      className={`rounded-md border border-emerald-200 bg-emerald-50/80 text-sm ${destaque ? "px-3 py-3" : "px-3 py-2.5"} ${className}`}
    >
      {destaque ? (
        <>
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-800">Preço do ingresso</p>
          <p className="mt-1 text-2xl font-bold text-emerald-900">{formatBrl(d.precoVenda)}</p>
        </>
      ) : (
        <p className="text-sm font-semibold text-emerald-900">Ingresso: {formatBrl(d.precoVenda)}</p>
      )}
      <ul className="mt-2 space-y-1 text-xs text-emerald-950/90">
        <li>
          Taxa de serviço EventosBR ({rotuloTaxa(TARIFA_PADRAO)}):{" "}
          <strong>{formatBrl(d.taxaTotal)}</strong>
        </li>
        <li>
          Organizador recebe: <strong>{formatBrl(d.liquidoOrganizador)}</strong>
        </li>
        <li className="text-emerald-800/80">
          A taxa EventosBR é fixa — não muda com PIX ou cartão. Parcelamento pode incluir acréscimo explícito no
          checkout.
        </li>
      </ul>
      <p className="mt-2 text-[11px] text-emerald-800/70">
        <Link href="/planos" className="underline underline-offset-2 hover:text-emerald-900">
          Ver planos e taxas
        </Link>
      </p>
    </div>
  );
}
