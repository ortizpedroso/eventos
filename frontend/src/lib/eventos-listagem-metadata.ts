/** Metadata dinâmica da listagem `/eventos` (busca, categoria, cidade). */

export type EventosListagemMetadata = {
  title: string;
  description: string;
};

export function buildEventosListagemMetadata(input: {
  q?: string;
  categoria?: string;
  cidade?: string;
}): EventosListagemMetadata {
  const q = input.q?.trim() ?? "";
  const categoria = input.categoria?.trim() ?? "";
  const cidade = input.cidade?.trim() ?? "";

  if (q) {
    return {
      title: `Busca: ${q} | Eventos | EventosBR`,
      description: `Eventos relacionados a “${q}” na EventosBR.`,
    };
  }
  if (cidade && categoria) {
    return {
      title: `${categoria} em ${cidade} | EventosBR`,
      description: `Eventos de ${categoria} em ${cidade}: datas, locais e ingressos com pagamento seguro na EventosBR.`,
    };
  }
  if (cidade) {
    return {
      title: `Eventos em ${cidade} | EventosBR`,
      description: `Eventos em ${cidade}: datas, locais e ingressos com pagamento seguro na EventosBR.`,
    };
  }
  if (categoria) {
    return {
      title: `${categoria} | Eventos | EventosBR`,
      description: `Eventos de ${categoria} na EventosBR — datas, locais e ingressos com pagamento seguro.`,
    };
  }
  return {
    title: "Eventos | EventosBR",
    description:
      "Descubra eventos publicados na EventosBR: datas, locais e ingressos com pagamento seguro.",
  };
}
