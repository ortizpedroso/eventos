const STATUS_FALLBACK: Record<number, string> = {
  400: "Dados inválidos. Revise o formulário e tente novamente.",
  401: "Sessão expirada ou não autorizado. Faça login novamente.",
  403: "Você não tem permissão para realizar esta ação.",
  404: "Não encontramos o que você procurou.",
  409: "Não foi possível concluir — os dados podem estar em conflito.",
  422: "Alguns campos estão incorretos. Confira e tente de novo.",
  429: "Muitas tentativas em pouco tempo. Aguarde um minuto e tente novamente.",
  502: "Serviço temporariamente indisponível. Tente em instantes.",
  503: "Serviço em manutenção. Tente novamente em breve.",
};

export function mensagemErroHttp(status: number, detail?: unknown): string {
  let msg: string;
  if (typeof detail === "string" && detail.trim()) {
    msg = detail;
  } else if (Array.isArray(detail) && detail.length > 0) {
    const items = detail as { loc?: unknown[]; msg?: string }[];
    msg = items
      .map((e) => {
        const loc = Array.isArray(e.loc)
          ? e.loc.filter((x) => x !== "body" && typeof x === "string").join(".")
          : "";
        const m = e.msg ?? "inválido";
        return loc ? `${loc}: ${m}` : m;
      })
      .join("; ");
  } else if (status >= 500) {
    msg =
      STATUS_FALLBACK[status] ??
      "A API não respondeu corretamente. Confirme que o backend está a correr na porta 8000.";
  } else {
    msg = STATUS_FALLBACK[status] ?? `Não foi possível concluir a operação (erro ${status}).`;
  }
  return sanitizarMensagemPagamento(msg);
}

/** Oculta nome do processador de pagamentos em mensagens exibidas ao usuário. */
export function sanitizarMensagemPagamento(texto: string): string {
  return texto
    .replace(/conta\s+asaas/gi, "conta de recebimentos")
    .replace(/painel\s+asaas/gi, "sua conta de recebimentos")
    .replace(/subconta\s+asaas/gi, "conta de repasses")
    .replace(/chave\s+api\s+asaas/gi, "chave de acesso")
    .replace(/\basaas\b/gi, "processador de pagamentos")
    .replace(/walletid/gi, "ID da conta");
}
