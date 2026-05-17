"""Mensagens de erro expostas ao cliente sem vazar detalhes internos ou de fornecedores."""

STRIPE_CLIENTE = (
    "Não foi possível concluir a operação com o pagamento. Tente novamente ou contacte o suporte."
)
STRIPE_PIX_INATIVO = (
    "O PIX ainda não está ativo na conta Stripe desta plataforma. "
    "Ative em dashboard.stripe.com → Configurações → Formas de pagamento → Pix. "
    "Enquanto isso, use cartão."
)
REEMBOLSO_CLIENTE = (
    "Não foi possível processar o reembolso. Tente novamente ou contacte o suporte."
)
LISTA_EVENTOS_CLIENTE = "Não foi possível carregar os eventos. Tente novamente mais tarde."
