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
  elegivel_compra?: boolean;
};

export type Evento = {
  id: string;
  slug: string;
  nome: string;
  descricao: string;
  data_inicio: string;
  data_fim: string;
  local: string;
  cidade?: string | null;
  imagem_url?: string | null;
  /** Menor preço entre lotes ativos (sincronizado na API). */
  preco_ingresso: number;
  /** Preço do lote atualmente à venda; igual a `preco_ingresso` se só houver um lote elegível. */
  preco_compra?: number | null;
  /** Identificador do lote usado na compra (primeiro elegível por ordem). */
  lote_compra_id?: string | null;
  /** False quando lotes esgotados ou fora do período de vendas. */
  compra_disponivel?: boolean;
  motivo_compra_indisponivel?: string | null;
  ingresso_lotes?: IngressoLote[];
  categoria: string;
  mensagem_confirmacao?: string | null;
  publicado: boolean;
  limite_ingressos_por_cpf?: number | null;
  data_criacao: string;
  /** Dono do evento (para exibir ação de editar) */
  organizador_id: string;
  urgencia_modo?: string;
  urgencia_badge?: string | null;
  urgencia_ativo?: boolean;
  parcelamento_habilitado?: boolean;
  parcelamento_max?: number;
  aceita_interesse?: boolean;
  lista_espera_habilitada?: boolean;
  lista_espera_prazo_horas?: number;
  espera_janela_exclusiva_ativa?: boolean;
};

export type Usuario = {
  id: string;
  email: string;
  nome: string;
  tipo: string;
  data_criacao: string;
  /** False em contas de compra rápida ou login social sem senha local. */
  tem_senha?: boolean;
  email_verificado?: boolean;
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

export type AsaasPixPayload = {
  encoded_image?: string;
  copia_cola?: string;
  expiration_date?: string;
};

export type CriarPagamentoResponse = {
  client_secret: string;
  ingresso_id: string;
  ingresso_ids?: string[];
  quantidade?: number;
  /** Provedor ativo: asaas */
  payment_provider?: "asaas";
  /** Asaas: reserva criada, aguarda POST /asaas/cobranca */
  aguardando_cobranca?: boolean;
  /** Quando a API está com pagamentos desativados (teste). */
  payments_disabled?: boolean;
  cortesia?: boolean;
  pix_disponivel?: boolean;
  pix?: AsaasPixPayload;
  invoice_url?: string;
  payment_id?: string;
  valor_centavos?: number;
  /** ISO 8601 UTC — prazo até quando a reserva é válida (35 min). */
  reservado_ate?: string | null;
};

export type RetomarPagamentoResponse = CriarPagamentoResponse & {
  ja_pago?: boolean;
  participante_nome?: string | null;
  participante_email?: string | null;
  valor_centavos?: number;
  evento_slug?: string;
};

export type IngressoListItem = {
  id: string;
  evento: {
    id?: string;
    slug?: string;
    nome: string;
    data: string;
    data_fim: string;
    local: string;
  };
  participante_nome: string | null;
  participante_email: string | null;
  valor: number;
  status: string;
  data_compra: string;
  repassado_para_nome: string | null;
  repassado_para_email: string | null;
  repassado_em: string | null;
  /** ISO 8601 UTC — prazo da reserva pendente. Nulo quando já pago/cancelado. */
  reservado_ate: string | null;
  /** EBR1:… — código para digitar na portaria (só quando pago ou usado). */
  codigo_checkin?: string | null;
};

export type PagamentoListItem = {
  id: string;
  evento: {
    id: string;
    slug?: string;
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
  reservado_ate?: string | null;
};

export type NotificacaoUsuario = {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  link: string | null;
  lida: boolean;
  data_criacao: string;
};
