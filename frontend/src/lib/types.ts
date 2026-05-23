export type IngressoTipo = "inteira" | "meia" | "vip" | "cortesia";

export type IngressoLote = {
  id: string;
  nome: string;
  tipo?: IngressoTipo;
  preco: number;
  ordem: number;
  quantidade_maxima: number | null;
  ativo: boolean;
  vendas_inicio: string | null;
  vendas_fim: string | null;
  vendidos: number;
};

export type Evento = {
  id: string;
  slug: string;
  nome: string;
  descricao: string;
  data_inicio: string;
  data_fim: string;
  local: string;
  imagem_url?: string | null;
  /** Menor preço entre lotes ativos (sincronizado na API). */
  preco_ingresso: number;
  /** Preço do lote atualmente à venda; igual a `preco_ingresso` se só houver um lote elegível. */
  preco_compra?: number | null;
  /** Identificador do lote usado na compra (primeiro elegível por ordem). */
  lote_compra_id?: string | null;
  ingresso_lotes?: IngressoLote[];
  categoria: string;
  mensagem_confirmacao?: string | null;
  publicado: boolean;
  limite_ingressos_por_cpf?: number | null;
  data_criacao: string;
  /** Dono do evento (para exibir ação de editar) */
  organizador_id: string;
};

export type Usuario = {
  id: string;
  email: string;
  nome: string;
  tipo: string;
  data_criacao: string;
  aceita_comunicacao_email?: boolean;
  aceita_comunicacao_whatsapp?: boolean;
  telefone?: string | null;
  comunicacao_consentimento_em?: string | null;
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
  usuario: Usuario;
};

export type CriarPagamentoResponse = {
  client_secret: string;
  ingresso_id: string;
  /** Quando a API está com STRIPE_DISABLED: compra concluída sem cartão. */
  stripe_disabled?: boolean;
  cortesia?: boolean;
  /** False se a conta Stripe da plataforma não tiver PIX ativo no Dashboard. */
  pix_disponivel?: boolean;
};

export type IngressoListItem = {
  id: string;
  evento: { nome: string; data: string; data_fim: string; local: string };
  participante_nome: string | null;
  participante_email: string | null;
  valor: number;
  status: string;
  data_compra: string;
  repassado_para_nome: string | null;
  repassado_para_email: string | null;
  repassado_em: string | null;
};

export type PagamentoListItem = {
  id: string;
  evento: {
    id: string;
    nome: string;
    data: string;
    data_fim: string;
    local: string;
    mensagem_confirmacao?: string | null;
  };
  participante_nome: string | null;
  participante_email: string | null;
  participante_cpf?: string | null;
  participante_telefone?: string | null;
  valor: number;
  status: string;
  data_compra: string;
  data_limite_cancelamento: string;
};
