export function paymentProviderAtivo(): "asaas" {
  return "asaas";
}

/**
 * Marca do processador — citável no site público (credibilidade).
 * Asaas Gestão Financeira Instituição de Pagamento S.A. é instituição de
 * pagamento autorizada pelo Banco Central do Brasil (fato público verificável).
 */
export function nomeProcessadorPagamento(): string {
  return "Asaas";
}

/** Frase curta com autorização BC — para selos, FAQ e checkout. */
export function descricaoProcessadorPagamento(): string {
  return "Asaas, instituição de pagamento autorizada pelo Banco Central do Brasil";
}

export function labelPagamentoSeguro(): string {
  return (
    "Pagamento online via Asaas — instituição de pagamento autorizada pelo Banco Central do Brasil. " +
    "A EventosBR não armazena o número completo do cartão."
  );
}

/** Painel do organizador — UX de conta de recebimento (sem jargão interno). */
export function nomeGatewayOrganizador(): string {
  return "EventosBR";
}
