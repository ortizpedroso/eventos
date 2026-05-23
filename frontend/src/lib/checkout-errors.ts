/** Mensagens de erro amigáveis no checkout. */

export function mapCheckoutError(raw: string): string {
  const msg = raw.trim();
  const lower = msg.toLowerCase();

  if (
    lower.includes("não autenticado") ||
    lower.includes("not authenticated") ||
    lower.includes("unauthorized") ||
    lower.includes("401")
  ) {
    return "Entre na sua conta ou use a compra rápida (nome + e-mail) para continuar.";
  }
  if (lower.includes("limite") && lower.includes("cpf")) {
    return "Este CPF já atingiu o limite de ingressos para este evento. Use outro CPF ou fale com o organizador.";
  }
  if (lower.includes("cupom")) {
    return msg.includes("Cupom") ? msg : "Cupom inválido ou expirado. Remova o cupom ou tente outro código.";
  }
  if (lower.includes("lote") || lower.includes("esgotad") || lower.includes("indisponível")) {
    return "Este lote não está mais disponível. Recarregue a página — o preço pode ter mudado.";
  }
  if (lower.includes("valor incorreto") || lower.includes("recarregue")) {
    return "O preço foi atualizado. Recarregue a página e tente novamente.";
  }
  if (lower.includes("e-mail já") || lower.includes("email já") || lower.includes("409")) {
    return "Este e-mail já tem conta. Use «Entrar» ou «Continuar com Google».";
  }
  if (lower.includes("stripe") && lower.includes("cliente")) {
    return "Não foi possível preparar o pagamento. Tente de novo em instantes ou entre em contato com o suporte.";
  }
  return msg;
}

export function isDevCheckoutWarning(): boolean {
  return process.env.NODE_ENV !== "production";
}
