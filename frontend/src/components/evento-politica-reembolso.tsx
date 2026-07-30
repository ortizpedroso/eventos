import Link from "next/link";

/** Linha curta de reembolso na zona de compra (única menção ao lado do checkout). */
export function EventoPoliticaReembolso() {
  return (
    <p className="text-xs leading-relaxed text-zinc-600" aria-label="Política de reembolso">
      <span className="font-semibold text-emerald-800">Reembolso em até 10 dias</span>
      {" — "}
      cancele em Minha conta → Pagamentos, se o ingresso ainda não tiver sido usado.{" "}
      <Link href="/termos" className="font-medium text-emerald-700 underline-offset-2 hover:underline">
        Termos
      </Link>
    </p>
  );
}
