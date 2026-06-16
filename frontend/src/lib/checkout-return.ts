/** URL de retorno pós-pagamento Stripe — sempre na página do evento (checkout unificado). */
export function urlPosCompraEvento(eventoSlug: string, ingressoId: string): string {
  const qs = new URLSearchParams({
    compra: "ok",
    ingresso: ingressoId,
  });
  return `/eventos/${eventoSlug}?${qs.toString()}#comprar`;
}

export function urlPosCompraEventoAbsoluta(
  origin: string,
  eventoSlug: string,
  ingressoId: string,
): string {
  return `${origin.replace(/\/$/, "")}${urlPosCompraEvento(eventoSlug, ingressoId)}`;
}
