import Link from "next/link";

/** Política de reembolso visível na página pública do evento (Fase A). */
export function EventoPoliticaReembolso() {
  return (
    <aside
      className="rounded-lg border border-emerald-200/80 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-950 [&_p]:text-justify"
      aria-label="Política de reembolso"
    >
      <p className="font-semibold text-emerald-900">Reembolso em até 10 dias</p>
      <p className="mt-1 text-xs leading-relaxed text-emerald-900/90">
        Após a compra, você pode solicitar cancelamento e reembolso integral em{" "}
        <strong>Minha conta → Pagamentos</strong>, sem precisar contactar o organizador, desde que
        esteja dentro do prazo de 10 dias e o ingresso ainda não tenha sido utilizado na entrada.
      </p>
      <p className="mt-2 text-xs text-emerald-800/80">
        <Link href="/termos" className="underline-offset-2 hover:underline">
          Termos de uso
        </Link>
        {" · "}
        <Link href="/privacidade" className="underline-offset-2 hover:underline">
          Privacidade
        </Link>
      </p>
    </aside>
  );
}
