export function paymentProviderAtivo(): "asaas" | "stripe" {
  const p = (process.env.NEXT_PUBLIC_PAYMENT_PROVIDER || "asaas").trim().toLowerCase();
  return p === "stripe" ? "stripe" : "asaas";
}

export function nomeProcessadorPagamento(): string {
  return paymentProviderAtivo() === "asaas" ? "Asaas" : "Stripe";
}
