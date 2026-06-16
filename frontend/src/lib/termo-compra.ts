/** Versão do termo exibido no checkout — altere ao atualizar o texto legal. */
export const TERMO_COMPRA_VERSAO = "2026-05-v1";

export type ItemTermoCompra = {
  id: string;
  texto: string;
};

/** Termo de responsabilidade na compra (adaptado ao modelo EventosBR). */
export const ITENS_TERMO_COMPRA: ItemTermoCompra[] = [
  {
    id: "plataforma",
    texto:
      "A EventosBR é plataforma de venda de ingressos/inscrições on-line. Não organizamos, produzimos nem operamos o evento — a responsabilidade pela realização, conteúdo, alterações de data/local e cumprimento das regras do evento é do ORGANIZADOR.",
  },
  {
    id: "participacao",
    texto:
      "Participo deste evento por livre e espontânea vontade, assumindo os riscos inerentes à modalidade e ao local, e isento organizadores, patrocinadores e a EventosBR de responsabilidade por acidentes ou danos decorrentes da minha participação, na medida permitida pela lei.",
  },
  {
    id: "informacoes",
    texto:
      "É minha responsabilidade conferir data, horário, local, requisitos de idade, documentos e demais informações na página do evento antes de comprar.",
  },
  {
    id: "pagamento",
    texto:
      "O ingresso só é garantido após confirmação do pagamento. Reservas pendentes podem expirar e a vaga ser liberada se o pagamento não for concluído no prazo indicado.",
  },
  {
    id: "preco",
    texto:
      "O preço exibido na vitrine já inclui a taxa da plataforma EventosBR (sem acréscimo surpresa no checkout), salvo desconto por cupom válido informado pelo organizador.",
  },
  {
    id: "reembolso",
    texto:
      "Reembolso: posso solicitar cancelamento em Minha conta → Pagamentos dentro de até 10 dias após a compra, se o ingresso não tiver sido usado na entrada, conforme política da plataforma e legislação aplicável. A não comparecimento ao evento, por si só, não gera reembolso automático fora desse prazo.",
  },
  {
    id: "organizador",
    texto:
      "Alterações, cancelamento ou adiamento do evento pelo organizador seguem as regras divulgadas na página do evento e na legislação. A EventosBR atua como intermediária tecnológica de pagamentos quando aplicável.",
  },
  {
    id: "terceiros",
    texto:
      "Se comprar para outra pessoa, declaro ter autorização do participante, que conhece estes termos e o regulamento/descrição do evento, e garanto a veracidade dos dados informados.",
  },
  {
    id: "imagem",
    texto:
      "Autorizo o uso, pelo organizador e pela EventosBR, de imagens ou gravações da minha participação divulgadas no contexto do evento, salvo oposição feita diretamente ao organizador quando a lei permitir.",
  },
  {
    id: "comunicacao",
    texto:
      "Comunicações de marketing da EventosBR dependem de opt-in no meu perfil (LGPD). E-mails transacionais sobre a compra e o ingresso podem ser enviados conforme a Política de Privacidade.",
  },
  {
    id: "aceite",
    texto:
      "Li e concordo com este Termo de Compra, com o Regulamento/regras descritas na página deste evento, com os Termos de Uso e com a Política de Privacidade da EventosBR.",
  },
];
