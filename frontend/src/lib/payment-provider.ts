export function paymentProviderAtivo(): "asaas" {
  return "asaas";
}

/** Copy voltada ao comprador — sem expor marca do gateway. */
export function nomeProcessadorPagamento(): string {
  return "gateway de pagamento certificado";
}

export function labelPagamentoSeguro(): string {
  return "Pagamento seguro";
}

/** Painel do organizador e documentação interna. */
export function nomeGatewayOrganizador(): string {
  return "Asaas";
}
