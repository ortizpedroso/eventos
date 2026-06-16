/** Verifica se a reserva pendente ainda está dentro do prazo. */
export function reservaAindaValida(reservadoAte: string | null | undefined): boolean {
  if (!reservadoAte) return false;
  const expiry = new Date(reservadoAte).getTime();
  if (Number.isNaN(expiry)) return false;
  return expiry > Date.now();
}

export function urlRetomarPagamento(eventoSlug: string, ingressoId: string): string {
  return `/eventos/${eventoSlug}?retomar=${encodeURIComponent(ingressoId)}#comprar`;
}
