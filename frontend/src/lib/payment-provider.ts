export function paymentProviderAtivo(): "asaas" {
  return "asaas";
}

/** Copy voltada ao comprador — sem expor marca do gateway. */
export function nomeProcessadorPagamento(): string {
  return "pagamento seguro pela plataforma";
}

export function labelPagamentoSeguro(): string {
  return nomeProcessadorPagamento();
}

/** Painel do organizador — white-label. */
export function nomeGatewayOrganizador(): string {
  return "EventosBR";
}
