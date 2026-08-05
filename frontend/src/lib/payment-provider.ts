export function paymentProviderAtivo(): "asaas" {
  return "asaas";
}

/** Copy voltada ao comprador — sem expor marca do gateway (white-label). */
export function nomeProcessadorPagamento(): string {
  return "processador de pagamentos certificado";
}

export function labelPagamentoSeguro(): string {
  return "Pagamento online via processador certificado — a EventosBR não armazena o número completo do cartão.";
}

/** Painel do organizador — white-label. */
export function nomeGatewayOrganizador(): string {
  return "EventosBR";
}
