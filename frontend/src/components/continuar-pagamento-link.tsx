import Link from "next/link";

import { reservaAindaValida, urlRetomarPagamento } from "@/lib/reserva-pagamento";

type Props = {
  ingressoId: string;
  eventoSlug?: string | null;
  reservadoAte?: string | null;
  status: string;
  className?: string;
};

export function ContinuarPagamentoLink({
  ingressoId,
  eventoSlug,
  reservadoAte,
  status,
  className = "",
}: Props) {
  if (status !== "pendente" || !reservaAindaValida(reservadoAte) || !eventoSlug) {
    return null;
  }

  return (
    <Link
      href={urlRetomarPagamento(eventoSlug, ingressoId)}
      className={`inline-flex items-center justify-center rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-800 ${className}`}
    >
      Continuar pagamento
    </Link>
  );
}
